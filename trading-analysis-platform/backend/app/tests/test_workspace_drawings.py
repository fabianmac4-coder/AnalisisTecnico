"""Pruebas de dibujos aislados por workspace (C0101.C030Id)."""
from __future__ import annotations

from datetime import datetime

from app.models import AnalisisDibujo
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.sql_utils import next_id
from app.tests.conftest import login_headers, make_user


def _auth(client, db, username="dw_user", email="dw@example.com"):
    make_user(db, username, email)
    return login_headers(client, username)


def _drawing_payload(c030_id: int, tf: str = "1Y_1D") -> dict:
    return {
        "symbol": "AAPL",
        "c030Id": c030_id,
        "sourceTimeframe": tf,
        "type": "free_line",
        "points": [{"time": 1.0, "price": 1.0}, {"time": 2.0, "price": 2.0}],
        "style": {"color": "#fff", "width": 2, "lineStyle": "solid", "opacity": 1},
        "visible": True,
        "locked": False,
        "showOnAllTimeframes": True,
        "version": 3,
    }


def _two_workspaces(client, headers) -> tuple[int, int]:
    w1 = client.get("/api/layouts/stock/AAPL", headers=headers).json()[0]
    w2 = client.post(
        "/api/layouts/stock/AAPL", json={"name": "Short-term"}, headers=headers
    ).json()
    return w1["c030Id"], w2["c030Id"]


def test_create_requires_workspace(client, db_session):
    headers = _auth(client, db_session)
    payload = _drawing_payload(0)
    payload.pop("c030Id")
    res = client.post("/api/drawings", json=payload, headers=headers)
    assert res.status_code == 400
    assert "Workspace" in res.json()["detail"]


def test_drawing_saved_with_workspace(client, db_session):
    headers = _auth(client, db_session)
    ws1, _ = _two_workspaces(client, headers)
    res = client.post("/api/drawings", json=_drawing_payload(ws1), headers=headers)
    assert res.status_code == 201, res.text
    assert res.json()["c030Id"] == ws1


def test_drawings_isolated_by_workspace(client, db_session):
    headers = _auth(client, db_session)
    ws1, ws2 = _two_workspaces(client, headers)
    client.post("/api/drawings", json=_drawing_payload(ws1), headers=headers)

    in_ws1 = client.get(
        "/api/drawings", params={"symbol": "AAPL", "c030Id": ws1}, headers=headers
    ).json()
    in_ws2 = client.get(
        "/api/drawings", params={"symbol": "AAPL", "c030Id": ws2}, headers=headers
    ).json()
    assert len(in_ws1) == 1
    assert in_ws1[0]["c030Id"] == ws1
    assert in_ws2 == []  # el dibujo de ws1 NO aparece en ws2


def test_create_rejects_workspace_of_other_stock(client, db_session):
    headers = _auth(client, db_session)
    # Workspace de MSFT; intentar crear un dibujo de AAPL con ese workspace.
    msft_ws = client.get("/api/layouts/stock/MSFT", headers=headers).json()[0]
    res = client.post(
        "/api/drawings", json=_drawing_payload(msft_ws["c030Id"]), headers=headers
    )
    assert res.status_code == 400


def test_legacy_null_drawings_only_in_default_workspace(client, db_session):
    headers = _auth(client, db_session)
    uid = client.get("/api/auth/me", headers=headers).json()["id"]
    ws1, ws2 = _two_workspaces(client, headers)  # ws1 es el default
    accion = AccionesRepository(db_session).get_by_yahoo_symbol("AAPL")

    now = datetime.utcnow()
    db_session.add(
        AnalisisDibujo(
            C0101Id=next_id(db_session, AnalisisDibujo.C0101Id),
            C005Id=uid,
            C010Id=accion.C010Id,
            C030Id=None,  # heredado, sin workspace
            TipoDibujo="free_line",
            TemporalidadOrigen="1Y_1D",
            PuntosJSON="[]",
            EstiloJSON="{}",
            FechaCreacion=now,
            FechaActualizacion=now,
        )
    )
    db_session.commit()

    default_ws = client.get(
        "/api/drawings", params={"symbol": "AAPL", "c030Id": ws1}, headers=headers
    ).json()
    other_ws = client.get(
        "/api/drawings", params={"symbol": "AAPL", "c030Id": ws2}, headers=headers
    ).json()
    # El dibujo heredado aparece en el default, NO en los demas workspaces.
    assert any(d["c030Id"] is None for d in default_ws)
    assert all(d["c030Id"] is not None for d in other_ws)


def test_delete_only_affects_own_workspace_drawing(client, db_session):
    headers = _auth(client, db_session)
    ws1, ws2 = _two_workspaces(client, headers)
    d1 = client.post("/api/drawings", json=_drawing_payload(ws1), headers=headers).json()
    d2 = client.post("/api/drawings", json=_drawing_payload(ws2), headers=headers).json()

    res = client.delete(f"/api/drawings/{d2['id']}", headers=headers)
    assert res.status_code == 204
    remaining_ws1 = client.get(
        "/api/drawings", params={"symbol": "AAPL", "c030Id": ws1}, headers=headers
    ).json()
    remaining_ws2 = client.get(
        "/api/drawings", params={"symbol": "AAPL", "c030Id": ws2}, headers=headers
    ).json()
    assert [d["id"] for d in remaining_ws1] == [d1["id"]]
    assert remaining_ws2 == []
