"""Tests de las cajas Long/Short Position (C0101) + zona horaria de exchange."""
from __future__ import annotations

import pandas as pd

from app.models import AnalisisDibujo
from app.services import yahoo_service
from app.tests.conftest import login_headers, make_user


def _auth(client, db, username="pos_user", email="pos@example.com"):
    make_user(db, username, email)
    return login_headers(client, username)


def _ws(client, headers) -> int:
    return client.get("/api/layouts/stock/AAPL", headers=headers).json()[0]["c030Id"]


def _box_payload(c030_id: int, tool="LONG_POSITION") -> dict:
    return {
        "symbol": "AAPL",
        "c030Id": c030_id,
        "sourceTimeframe": "1Y_1D",
        "type": tool,
        # 3 puntos: entry / target / stop (geometría).
        "points": [
            {"time": 1.78e12, "price": 185.25},
            {"time": 1.781e12, "price": 210.0},
            {"time": 1.781e12, "price": 176.0},
        ],
        "style": {
            "color": "#22c55e",
            "fillOpacity": 0.08,
            "position": {"quantity": 10, "fees": 0, "notes": "breakout retest",
                         "chartContextKey": "1Y_1d"},
        },
        "visible": True,
        "locked": False,
        "showOnAllTimeframes": False,
        "version": 1,
    }


# --------------------------------------------------------------------------
# API de dibujos acepta LONG/SHORT con datos de posición (round-trip)
# --------------------------------------------------------------------------
def test_create_long_position_box_roundtrips(client, db_session):
    headers = _auth(client, db_session)
    res = client.post("/api/drawings", json=_box_payload(_ws(client, headers)), headers=headers)
    assert res.status_code == 201, res.text
    out = res.json()
    assert out["type"] == "LONG_POSITION"
    assert len(out["points"]) == 3
    assert out["style"]["position"]["quantity"] == 10
    assert out["style"]["position"]["notes"] == "breakout retest"
    # Persistido en C0101 con el tipo correcto.
    row = db_session.query(AnalisisDibujo).filter_by(TipoDibujo="LONG_POSITION").one()
    assert row.C005Id == 1


def test_create_short_position_box(client, db_session):
    headers = _auth(client, db_session)
    res = client.post("/api/drawings",
                      json=_box_payload(_ws(client, headers), "SHORT_POSITION"), headers=headers)
    assert res.status_code == 201, res.text
    assert res.json()["type"] == "SHORT_POSITION"


def test_invalid_drawing_type_rejected(client, db_session):
    headers = _auth(client, db_session)
    payload = _box_payload(_ws(client, headers))
    payload["type"] = "BOGUS_TYPE"
    assert client.post("/api/drawings", json=payload, headers=headers).status_code == 422


def _line_payload(c030_id: int, source_tf: str, slot_id: str) -> dict:
    return {
        "symbol": "AAPL",
        "c030Id": c030_id,
        "sourceTimeframe": source_tf,
        "type": "free_line",
        "points": [{"time": 1.0, "price": 1.0}, {"time": 2.0, "price": 2.0}],
        # chartSlotId viaja dentro de EstiloJSON (passthrough opaco).
        "style": {"color": "#ffffff", "chartSlotId": slot_id},
        "visible": True,
        "locked": False,
        "showOnAllTimeframes": True,
        "version": 3,
    }


def test_chart_slot_id_roundtrips_and_listing_ignores_timeframe(client, db_session):
    headers = _auth(client, db_session)
    ws = _ws(client, headers)
    # Dos dibujos en chart_1 con DISTINTA temporalidad de origen.
    a = client.post("/api/drawings", json=_line_payload(ws, "4Y_1W", "chart_1"), headers=headers)
    b = client.post("/api/drawings", json=_line_payload(ws, "1W_30M", "chart_1"), headers=headers)
    assert a.status_code == 201, a.text
    assert b.status_code == 201, b.text
    # chartSlotId round-trip vía EstiloJSON.
    assert a.json()["style"]["chartSlotId"] == "chart_1"
    # El GET del workspace devuelve AMBOS, sin filtrar por temporalidad.
    rows = client.get(
        "/api/drawings", params={"symbol": "AAPL", "c030Id": ws}, headers=headers
    ).json()
    slots = [r["style"].get("chartSlotId") for r in rows]
    assert slots.count("chart_1") == 2


# --------------------------------------------------------------------------
# Aislamiento: no se crea/edita/borra la caja de otro usuario
# --------------------------------------------------------------------------
def test_position_box_cannot_use_another_users_workspace(client, db_session):
    ha = _auth(client, db_session, "Ana", "ana@x.com")
    c030 = _ws(client, ha)
    hb = _auth(client, db_session, "Beto", "beto@x.com")
    res = client.post("/api/drawings", json=_box_payload(c030), headers=hb)
    assert res.status_code in (400, 403, 404)


def test_position_box_update_delete_scoped_to_owner(client, db_session):
    ha = _auth(client, db_session, "Ana", "ana@x.com")
    ws = _ws(client, ha)
    box = client.post("/api/drawings", json=_box_payload(ws), headers=ha).json()
    hb = _auth(client, db_session, "Beto", "beto@x.com")
    # PATCH ajeno -> 404; DELETE ajeno es idempotente (204) pero NO borra nada.
    assert client.patch(f"/api/drawings/{box['id']}", json={**box, "locked": True},
                        headers=hb).status_code == 404
    client.delete(f"/api/drawings/{box['id']}", headers=hb)  # no-op idempotente
    # La caja de Ana sigue intacta (no la tocó Beto).
    ana_boxes = client.get("/api/drawings", params={"symbol": "AAPL", "c030Id": ws}, headers=ha).json()
    assert any(b["id"] == box["id"] for b in ana_boxes)


# --------------------------------------------------------------------------
# Zona horaria del exchange en la respuesta OHLCV
# --------------------------------------------------------------------------
def _make_df() -> pd.DataFrame:
    idx = pd.to_datetime(["2026-06-01", "2026-06-02"], utc=True)
    return pd.DataFrame(
        {"Open": [1, 2], "High": [2, 3], "Low": [0.5, 1.5], "Close": [1.5, 2.5], "Volume": [10, 20]},
        index=idx,
    )


def test_ohlcv_includes_exchange_timezone(monkeypatch):
    monkeypatch.setattr(yahoo_service, "_download", lambda s, p: _make_df())
    monkeypatch.setattr(yahoo_service, "_resolve_meta", lambda s: ("USD", "America/New_York"))
    resp = yahoo_service.get_ohlcv("AAPL", "1Y_1D", force_refresh=True)
    assert resp.exchangeTimezone == "America/New_York"
    assert resp.dataTimezone == "UTC"


def test_ohlcv_missing_timezone_falls_back_cleanly(monkeypatch):
    monkeypatch.setattr(yahoo_service, "_download", lambda s, p: _make_df())
    monkeypatch.setattr(yahoo_service, "_resolve_meta", lambda s: (None, None))
    resp = yahoo_service.get_ohlcv("SOMETHING", "1Y_1D", force_refresh=True)
    assert resp.exchangeTimezone is None
    assert resp.dataTimezone == "UTC"  # los datos SIEMPRE son UTC
