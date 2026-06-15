"""Pruebas del Executive Stock Scorecard (datos de mercado mockeados)."""
from __future__ import annotations

import json

import pytest

from app.models import CatalogoUsuarioAccion
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.sql_utils import next_id, utcnow
from app.services import ai_context_service, news_service, yahoo_service
from app.services import stock_scorecard_service as scorecard
from app.tests.conftest import login_headers, make_user


def _market(closes: list[float]) -> dict:
    return {
        "market_data_available": True,
        "quote": {
            "price": closes[-1],
            "change": 1.0,
            "changePercent": 0.5,
            "currency": "USD",
        },
        "asOf": "2026-06-01",
        "daily_1y": {
            "high20d": max(closes[-20:]),
            "low20d": min(closes[-20:]),
            "yearHigh": max(closes),
            "yearLow": min(closes),
        },
        "_closes_1d": list(closes),
        "_volumes_1d": [1000] * len(closes),
    }


RISING = [100 + i * 0.2 for i in range(260)]  # tendencia alcista (sma200 disponible)
FUNDS = {
    "trailingPE": 22.0,
    "profitMargins": 0.25,
    "returnOnEquity": 0.30,
    "returnOnAssets": 0.12,
    "revenueGrowth": 0.10,
    "earningsGrowth": 0.12,
    "debtToEquity": 60.0,
    "currentRatio": 1.4,
    "priceToBook": 5.0,
    "priceToSalesTrailing12Months": 6.0,
    "longName": "Apple Inc.",
}


@pytest.fixture()
def patch_data(monkeypatch):
    """Por defecto: mercado alcista + fundamentales, sin noticias ni sentimiento."""
    monkeypatch.setattr(ai_context_service, "_market_summary", lambda s: _market(RISING))
    monkeypatch.setattr(
        yahoo_service, "get_fundamentals", lambda s, force_refresh=False: dict(FUNDS)
    )
    monkeypatch.setattr(news_service, "get_symbol_news", lambda s, limit=8: [])
    monkeypatch.setattr(
        scorecard, "_score_sentiment", lambda *a, **k: {"score": None, "strengths": [], "risks": []}
    )
    return monkeypatch


def _auth(client, db, username="sc_user", email="sc@example.com"):
    make_user(db, username, email)
    return login_headers(client, username)


def test_scorecard_requires_auth(client):
    res = client.get("/api/stocks/AAPL/scorecard")
    assert res.status_code == 401


def test_unknown_symbol_returns_404(client, db_session, monkeypatch):
    headers = _auth(client, db_session)
    monkeypatch.setattr(
        ai_context_service, "_market_summary", lambda s: {"market_data_available": False}
    )
    monkeypatch.setattr(yahoo_service, "get_fundamentals", lambda s, force_refresh=False: {})
    monkeypatch.setattr(news_service, "get_symbol_news", lambda s, limit=8: [])
    monkeypatch.setattr(
        scorecard, "_score_sentiment", lambda *a, **k: {"score": None, "strengths": [], "risks": []}
    )
    res = client.get("/api/stocks/ZZZZ/scorecard", headers=headers)
    assert res.status_code == 404


def test_technical_score_present(client, db_session, patch_data):
    headers = _auth(client, db_session)
    res = client.get("/api/stocks/AAPL/scorecard", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["technicalScore"] is not None
    assert body["dataAvailability"]["technical"] is True
    assert body["overallScore"] is not None
    assert body["companyName"] == "Apple Inc."
    assert isinstance(body["strengths"], list)
    assert body["summary"]


def test_missing_fundamentals_no_crash(client, db_session, patch_data, monkeypatch):
    headers = _auth(client, db_session)
    monkeypatch.setattr(yahoo_service, "get_fundamentals", lambda s, force_refresh=False: {})
    res = client.get("/api/stocks/AAPL/scorecard", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["fundamentalScore"] is None
    assert body["dataAvailability"]["fundamentals"] is False
    assert "Fundamental data is limited." in body["warnings"]


def test_no_relevant_news_no_crash(client, db_session, patch_data):
    headers = _auth(client, db_session)
    res = client.get("/api/stocks/AAPL/scorecard", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["newsScore"] is None
    assert body["dataAvailability"]["news"] is False


def test_overall_redistributes_when_sentiment_missing():
    tech = {"score": 80}
    fund = {"score": 60}
    news = {"score": 50}
    # Sin sentimiento: pesos 0.4/0.3/0.2 (suma 0.9) -> (32+18+10)/0.9 = 66.7 -> 67.
    assert scorecard._overall_score(tech, fund, news, {"score": None}) == 67
    # Con sentimiento 50: pesos completos -> 32+18+10+5 = 65.
    assert scorecard._overall_score(tech, fund, news, {"score": 50}) == 65


def test_insufficient_data_view(client, db_session, monkeypatch):
    headers = _auth(client, db_session)
    # La accion existe (sin 404), pero no hay tecnico/fundamental/noticias.
    AccionesRepository(db_session).get_or_create_from_yahoo_symbol("AAPL")
    db_session.commit()
    monkeypatch.setattr(
        ai_context_service, "_market_summary", lambda s: {"market_data_available": False}
    )
    monkeypatch.setattr(yahoo_service, "get_fundamentals", lambda s, force_refresh=False: {})
    monkeypatch.setattr(news_service, "get_symbol_news", lambda s, limit=8: [])
    monkeypatch.setattr(
        scorecard, "_score_sentiment", lambda *a, **k: {"score": None, "strengths": [], "risks": []}
    )
    res = client.get("/api/stocks/AAPL/scorecard", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["overallView"] == "INSUFFICIENT_DATA"


def test_no_sensitive_data_exposed(client, db_session, patch_data):
    headers = _auth(client, db_session)
    res = client.get("/api/stocks/AAPL/scorecard", headers=headers)
    assert res.status_code == 200
    blob = json.dumps(res.json()).lower()
    assert "passwordhash" not in blob
    assert "password" not in blob
    assert "token" not in blob


def test_watchlist_notes_scoped_by_user(client, db_session, patch_data):
    # Usuario A con nota; usuario B no debe verla.
    a = make_user(db_session, "alice_sc", "alice_sc@example.com")
    make_user(db_session, "bob_sc", "bob_sc@example.com")
    accion = AccionesRepository(db_session).get_or_create_from_yahoo_symbol("AAPL")
    db_session.flush()
    now = utcnow()
    db_session.add(
        CatalogoUsuarioAccion(
            C040Id=next_id(db_session, CatalogoUsuarioAccion.C040Id),
            C005Id=a.C005Id,
            C010Id=accion.C010Id,
            Notas="nota secreta de alice",
            Activo=True,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
    )
    db_session.commit()

    ha = login_headers(client, "alice_sc")
    hb = login_headers(client, "bob_sc")
    body_a = client.get("/api/stocks/AAPL/scorecard", headers=ha).json()
    body_b = client.get("/api/stocks/AAPL/scorecard", headers=hb).json()
    assert any("nota secreta de alice" in w for w in body_a["watchItems"])
    assert not any("nota secreta de alice" in w for w in body_b["watchItems"])


def test_force_refresh_accepted(client, db_session, patch_data):
    headers = _auth(client, db_session)
    res = client.get(
        "/api/stocks/AAPL/scorecard",
        params={"forceRefresh": "true", "workspaceId": 5, "focusedChartSlotId": "chart_1"},
        headers=headers,
    )
    assert res.status_code == 200


def test_response_includes_breakdown_and_scoring_config(client, db_session, patch_data):
    headers = _auth(client, db_session)
    body = client.get("/api/stocks/AAPL/scorecard", headers=headers).json()
    assert set(body["breakdown"].keys()) == {
        "technical", "fundamentals", "news", "sentiment"
    }
    fund_metrics = body["breakdown"]["fundamentals"]["metrics"]
    assert len(fund_metrics) > 0
    m = fund_metrics[0]
    # Cada metrica expone valor, fuente, contribucion, estado y explicacion.
    for field in (
        "key", "label", "value", "displayValue", "source", "status",
        "scoreContribution", "maxContribution", "explanation",
    ):
        assert field in m
    assert m["source"] == "Yahoo Finance"
    # Config de puntuacion usada (C081).
    assert body["scoringConfig"]["c081Id"] > 0
    assert body["scoringConfig"]["name"] == "Default"


def test_missing_fundamentals_marked_missing_in_breakdown(
    client, db_session, patch_data, monkeypatch
):
    headers = _auth(client, db_session)
    monkeypatch.setattr(yahoo_service, "get_fundamentals", lambda s, force_refresh=False: {})
    body = client.get("/api/stocks/AAPL/scorecard", headers=headers).json()
    fund_metrics = body["breakdown"]["fundamentals"]["metrics"]
    assert all(m["status"] == "MISSING" for m in fund_metrics)


def test_changing_pe_threshold_changes_score(client, db_session, patch_data):
    headers = _auth(client, db_session)
    before = client.get("/api/stocks/AAPL/scorecard", headers=headers).json()
    score_before = before["fundamentalScore"]

    cfg = client.get("/api/scorecard/configs/default", headers=headers).json()
    config = cfg["configuration"]
    # Sube el umbral de P/E excelente: un P/E de 22 ahora puntua al maximo.
    config["fundamentals"]["peRatio"]["excellentMax"] = 50
    client.patch(
        f"/api/scorecard/configs/{cfg['c081Id']}",
        json={"configuration": config},
        headers=headers,
    )
    after = client.get(
        "/api/stocks/AAPL/scorecard", params={"forceRefresh": "true"}, headers=headers
    ).json()
    assert after["fundamentalScore"] > score_before
