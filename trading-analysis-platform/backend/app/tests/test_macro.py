"""Tests del Macro Dashboard (Fase 3). Sin red: se mockea yahoo_service."""
from __future__ import annotations

import pytest

from app.config import env_settings
from app.models import MarketCache
from app.repositories.market_cache_repository import MarketCacheRepository
from app.schemas.market import QuoteResponse
from app.services import macro as macro_service
from app.services import yahoo_service
from app.services.macro import economic_calendar_provider as cal
from app.services.macro import macro_interpretation_service as interp
from app.services.macro import macro_types as t
from app.services.macro import yahoo_macro_provider as ymp
from app.services.macro.fred_provider import FredProvider
from app.tests.conftest import login_headers, make_user


def fake_quote(symbol: str) -> QuoteResponse:
    price = 4.2 if symbol.startswith("^") else 100.0
    return QuoteResponse(
        symbol=symbol, price=price, previousClose=price - 1, change=0.5,
        changePercent=0.8, currency="USD", marketState="REGULAR",
        source="test", timestamp=0,
    )


@pytest.fixture
def patch_yahoo(monkeypatch):
    monkeypatch.setattr(yahoo_service, "get_quote", lambda s, force_refresh=False: fake_quote(s))
    # Fuerza FRED OFF de forma determinista (independiente del .env real),
    # para que estos tests NUNCA hagan llamadas de red a FRED.
    monkeypatch.setattr(FredProvider, "available", lambda self: False)
    return monkeypatch


def _auth(client, db_session, name="Ana", email="ana@example.com"):
    make_user(db_session, name, email)
    return login_headers(client, name)


# --------------------------------------------------------------------------
# Auth + estructura + datos parciales
# --------------------------------------------------------------------------
def test_overview_requires_auth(client):
    assert client.get("/api/macro/overview").status_code == 401


def test_overview_partial_without_fred(client, db_session, patch_yahoo):
    headers = _auth(client, db_session)
    res = client.get("/api/macro/overview", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    # Sin FRED, los indicadores de EE.UU. son MISSING pero la página no falla.
    assert body["dataAvailability"]["macroProviderConfigured"] is False
    assert body["usaIndicators"]["cpi"]["status"] == "MISSING"
    # Mercados globales sí (vía Yahoo mockeado).
    assert body["dataAvailability"]["globalMarketsAvailable"] is True
    assert len(body["globalMarkets"]["crypto"]) == 5
    assert "executiveSummary" in body and "whatThisMeans" in body


def test_overview_includes_warnings_when_provider_missing(client, db_session, patch_yahoo):
    headers = _auth(client, db_session)
    body = client.get("/api/macro/overview", headers=headers).json()
    joined = " ".join(body["warnings"]).lower()
    assert "fred api key is not configured" in joined
    assert "economic calendar provider is not configured" in joined
    assert body["dataAvailability"]["calendarAvailable"] is False
    assert body["economicCalendar"] == []


# --------------------------------------------------------------------------
# Cache C080
# --------------------------------------------------------------------------
def test_overview_cached_in_c080(client, db_session, patch_yahoo):
    headers = _auth(client, db_session)
    client.get("/api/macro/overview", headers=headers)
    rows = db_session.query(MarketCache).filter(
        MarketCache.TipoDato == "MACRO_OVERVIEW").all()
    assert len(rows) >= 1
    cached = MarketCacheRepository(db_session).get_fresh("MACRO_OVERVIEW", "global")
    assert cached is not None and "executiveSummary" in cached


def test_second_call_from_cache_and_force_refresh_bypasses(client, db_session, patch_yahoo):
    headers = _auth(client, db_session)
    first = client.get("/api/macro/overview", headers=headers).json()
    assert first["fromCache"] is False
    second = client.get("/api/macro/overview", headers=headers).json()
    assert second["fromCache"] is True
    forced = client.get("/api/macro/overview?forceRefresh=true", headers=headers).json()
    assert forced["fromCache"] is False


def test_provider_failure_returns_cached_data(client, db_session, patch_yahoo, monkeypatch):
    headers = _auth(client, db_session)
    good = client.get("/api/macro/overview", headers=headers).json()
    assert good["dataAvailability"]["globalMarketsAvailable"] is True
    # Yahoo cae: forceRefresh sin datos nuevos -> cache viejo con aviso.
    monkeypatch.setattr(yahoo_service, "get_quote",
                        lambda s, force_refresh=False: (_ for _ in ()).throw(RuntimeError()))
    stale = client.get("/api/macro/overview?forceRefresh=true", headers=headers).json()
    assert stale["fromCache"] is True
    assert any("cached" in w.lower() for w in stale["warnings"])


# --------------------------------------------------------------------------
# Curva + riesgo (unit)
# --------------------------------------------------------------------------
def test_yield_curve_status():
    assert interp.yield_curve_status(0.80) == t.CURVE_NORMAL
    assert interp.yield_curve_status(0.20) == t.CURVE_FLAT
    assert interp.yield_curve_status(-0.40) == t.CURVE_INVERTED
    assert interp.yield_curve_status(None) == t.CURVE_UNKNOWN


def test_macro_risk_levels():
    # Insuficientes señales -> UNKNOWN.
    r = interp.compute_risk({}, {"curveStatus": t.CURVE_UNKNOWN}, None)
    assert r["riskLevel"] == t.RISK_UNKNOWN
    # Señales de estrés -> RED.
    usa = {
        "cpi": {"status": "POSITIVE", "trend": t.WORSENING, "value": 5.0},
        "unemploymentRate": {"status": "NEGATIVE", "trend": t.WORSENING},
        "fedFundsRate": {"value": 5.5},
    }
    rates = {"curveStatus": t.CURVE_INVERTED}
    sent = {"score": 20, "components": [{"name": "VIX", "value": 30}]}
    red = interp.compute_risk(usa, rates, sent)
    assert red["riskLevel"] == t.RED
    assert red["drivers"] or red["risks"]
    # Señales benignas -> GREEN.
    usa_ok = {
        "cpi": {"status": "POSITIVE", "trend": t.IMPROVING, "value": 2.5},
        "gdpGrowth": {"status": "POSITIVE", "trend": t.IMPROVING},
        "fedFundsRate": {"value": 2.0},
    }
    green = interp.compute_risk(usa_ok, {"curveStatus": t.CURVE_NORMAL},
                                {"score": 72, "components": []})
    assert green["riskLevel"] == t.GREEN


# --------------------------------------------------------------------------
# Integración Scorecard + seguridad
# --------------------------------------------------------------------------
def test_macro_context_none_without_cache(db_session):
    # Sin cache, el contexto macro es None (el scorecard recibe None y no falla).
    assert macro_service.get_macro_context(db_session) is None


def test_macro_context_from_cache(db_session, patch_yahoo):
    macro_service.get_overview(db_session, force_refresh=True)
    ctx = macro_service.get_macro_context(db_session)
    assert ctx is not None
    assert "riskLevel" in ctx and "yieldCurveStatus" in ctx


def test_overview_exposes_no_sensitive_data(client, db_session, patch_yahoo):
    headers = _auth(client, db_session)
    raw = client.get("/api/macro/overview", headers=headers).text.lower()
    for secret in ("passwordhash", "accesstoken", "jwt_secret", "fred_api_key"):
        assert secret not in raw


# --------------------------------------------------------------------------
# Producción industrial (INDPRO) + Ventas minoristas (RSAFS) — reemplazan ISM
# --------------------------------------------------------------------------
def test_no_ism_indicators_in_overview(client, db_session, patch_yahoo):
    headers = _auth(client, db_session)
    usa = client.get("/api/macro/overview", headers=headers).json()["usaIndicators"]
    assert "ismManufacturing" not in usa and "ismServices" not in usa
    # Los reemplazos sí están presentes (MISSING con FRED off, pero presentes).
    assert "industrialProduction" in usa and "retailSales" in usa


def test_industrial_production_and_retail_sales_from_fred(monkeypatch):
    monkeypatch.setattr(FredProvider, "available", lambda self: True)

    def fake_series(self, sid, units):
        data = {"INDPRO": (103.42, 102.90, "2026-05-01"),
                "RSAFS": (720345.0, 715200.0, "2026-05-01")}
        return data.get(sid, (3.0, 2.5, "2026-05-01"))
    monkeypatch.setattr(FredProvider, "_series_latest", fake_series)

    inds, _w = FredProvider().fetch_indicators()
    ip = inds["industrialProduction"]
    assert ip["status"] == t.POSITIVE and ip["trend"] == t.IMPROVING
    assert ip["value"] == 103.42 and ip["displayValue"] == "103.42"
    rs = inds["retailSales"]
    assert rs["status"] == t.POSITIVE and rs["trend"] == t.IMPROVING
    assert rs["displayValue"] == "$720.3B"
    assert rs["changePercent"] is not None and rs["changePercent"] > 0


def test_indpro_failure_only_marks_it_missing(monkeypatch):
    monkeypatch.setattr(FredProvider, "available", lambda self: True)

    def fail_indpro(self, sid, units):
        if sid == "INDPRO":
            raise RuntimeError("boom")
        return (3.0, 2.5, "2026-05-01")
    monkeypatch.setattr(FredProvider, "_series_latest", fail_indpro)

    inds, warns = FredProvider().fetch_indicators()
    assert inds["industrialProduction"]["status"] == t.MISSING
    # El resto sigue disponible (sólo INDPRO falla).
    assert inds["retailSales"]["status"] != t.MISSING
    assert any("industrialProduction" in w for w in warns)


def test_retail_sales_series_id_overridable_by_env(monkeypatch):
    monkeypatch.setattr(FredProvider, "available", lambda self: True)
    monkeypatch.setattr(env_settings, "FRED_SERIES_RETAIL_SALES", "CUSTOM_RSAFS")
    seen: list[str] = []

    def capture(self, sid, units):
        seen.append(sid)
        return (700000.0, 690000.0, "2026-05-01")
    monkeypatch.setattr(FredProvider, "_series_latest", capture)
    FredProvider().fetch_indicators()
    assert "CUSTOM_RSAFS" in seen


def test_fetch_indicators_no_generic_warning_when_fred_on(monkeypatch):
    monkeypatch.setattr(FredProvider, "available", lambda self: True)
    monkeypatch.setattr(FredProvider, "_series_latest",
                        lambda self, sid, units: (3.0, 2.5, "2026-05-01"))
    _inds, warns = FredProvider().fetch_indicators()
    assert not any("FRED API key is not configured" in w for w in warns)


# --------------------------------------------------------------------------
# USD/MXN en FX
# --------------------------------------------------------------------------
def test_usd_mxn_in_fx(monkeypatch):
    monkeypatch.setattr(yahoo_service, "get_quote",
                        lambda s, force_refresh=False: fake_quote(s))
    markets, _w = ymp.fetch_global_markets()
    labels = [i["label"] for i in markets["fx"]]
    assert "USD/MXN" in labels
    syms = [i.get("symbol") for i in markets["fx"]]
    assert "MXN=X" in syms


# --------------------------------------------------------------------------
# Calendario económico FRED
# --------------------------------------------------------------------------
def test_calendar_unavailable_when_fred_off(monkeypatch, db_session):
    monkeypatch.setattr(FredProvider, "available", lambda self: False)
    events, warns, available, source = cal.build_calendar(db_session, False)
    assert events == [] and available is False and source == "UNAVAILABLE"
    assert any("not configured" in w.lower() for w in warns)


def test_calendar_uses_fred_release_dates(monkeypatch, db_session):
    monkeypatch.setattr(FredProvider, "available", lambda self: True)
    monkeypatch.setattr(FredProvider, "fetch_release_dates",
                        lambda self, rid, start, end, limit=24: ["2026-07-14"])
    events, warns, available, source = cal.build_calendar(db_session, False)
    assert available is True and source == "FRED"
    assert events and all(e["source"] == "FRED" and e["date"] == "2026-07-14"
                          for e in events)
    # Trae los releases importantes (CPI, NFP, GDP...).
    names = {e["eventName"] for e in events}
    assert any("CPI" in n for n in names)
