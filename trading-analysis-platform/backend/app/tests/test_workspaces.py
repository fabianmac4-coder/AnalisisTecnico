"""Pruebas de workspaces de analisis por accion (dbo.C030, /api/layouts/*)."""
from __future__ import annotations

from datetime import datetime

from app.models import AnalisisDibujo, OperacionSimulada
from app.tests.conftest import login_headers, make_user


def _auth(client, db, username="ws_user", email="ws@example.com"):
    make_user(db, username, email)
    return login_headers(client, username)


def test_list_creates_default_workspace(client, db_session):
    headers = _auth(client, db_session)
    res = client.get("/api/layouts/stock/AAPL", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body) == 1
    ws = body[0]
    assert ws["isDefault"] is True
    assert ws["name"] == "Default Analysis"
    assert ws["symbol"] == "AAPL"
    assert ws["c010Id"] > 0
    assert len(ws["chartSlots"]) == 6
    assert ws["chartSlots"][0]["slotId"] == "chart_1"


def test_workspaces_scoped_per_user(client, db_session):
    a = _auth(client, db_session, "alice", "alice@example.com")
    client.post(
        "/api/layouts/stock/AAPL", json={"name": "Alice LT"}, headers=a
    )
    # Segundo usuario: solo ve SU propio default autocreado, no el de alice.
    make_user(db_session, "bob", "bob@example.com")
    b = login_headers(client, "bob")
    res = client.get("/api/layouts/stock/AAPL", headers=b)
    assert res.status_code == 200
    names = [w["name"] for w in res.json()]
    assert "Alice LT" not in names
    assert names == ["Default Analysis"]


def test_create_sets_first_default_then_others_not(client, db_session):
    headers = _auth(client, db_session)
    first = client.post(
        "/api/layouts/stock/MSFT", json={"name": "Long-term"}, headers=headers
    )
    assert first.status_code == 201, first.text
    assert first.json()["isDefault"] is True

    second = client.post(
        "/api/layouts/stock/MSFT", json={"name": "Short-term"}, headers=headers
    )
    assert second.status_code == 201
    assert second.json()["isDefault"] is False


def test_duplicate_copies_chart_slots(client, db_session):
    headers = _auth(client, db_session)
    base = client.post(
        "/api/layouts/stock/NVDA", json={"name": "Base"}, headers=headers
    ).json()
    c030 = base["c030Id"]
    # Cambia un slot del workspace base.
    client.patch(
        f"/api/layouts/{c030}/chart-slots",
        json={"chartSlots": [{"slotId": "chart_1", "range": "1Y", "interval": "1h"}]},
        headers=headers,
    )
    dup = client.post(
        "/api/layouts/stock/NVDA",
        json={"name": "Base copy", "copyFromC030Id": c030},
        headers=headers,
    )
    assert dup.status_code == 201, dup.text
    body = dup.json()
    slot1 = next(s for s in body["chartSlots"] if s["slotId"] == "chart_1")
    assert slot1["range"] == "1Y"
    assert slot1["interval"] == "1h"


def test_patch_chart_slots_updates_only_target_and_preserves_config(
    client, db_session
):
    headers = _auth(client, db_session)
    ws = client.post(
        "/api/layouts/stock/TSLA", json={"name": "W"}, headers=headers
    ).json()
    c030 = ws["c030Id"]
    # Inyecta un ajuste no relacionado en la configuracion.
    client.patch(
        f"/api/layouts/{c030}",
        json={"configuration": {"panelSettings": {"showVolume": False}}},
        headers=headers,
    )
    # Cambia SOLO chart_1.
    res = client.patch(
        f"/api/layouts/{c030}/chart-slots",
        json={"chartSlots": [{"slotId": "chart_1", "range": "5Y", "interval": "1d"}]},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    slots = {s["slotId"]: s for s in body["chartSlots"]}
    assert slots["chart_1"]["range"] == "5Y"
    assert slots["chart_1"]["interval"] == "1d"
    # chart_2 conserva su default (no fue tocado).
    assert slots["chart_2"]["range"] == "1Y"
    assert slots["chart_2"]["interval"] == "1d"
    # El ajuste no relacionado sobrevive.
    assert body["configuration"]["panelSettings"]["showVolume"] is False


def test_set_default_unsets_others(client, db_session):
    headers = _auth(client, db_session)
    w1 = client.post(
        "/api/layouts/stock/AMD", json={"name": "One"}, headers=headers
    ).json()
    w2 = client.post(
        "/api/layouts/stock/AMD", json={"name": "Two"}, headers=headers
    ).json()
    assert w1["isDefault"] is True
    assert w2["isDefault"] is False

    res = client.patch(f"/api/layouts/{w2['c030Id']}/set-default", headers=headers)
    assert res.status_code == 200
    assert res.json()["isDefault"] is True

    listing = client.get("/api/layouts/stock/AMD", headers=headers).json()
    by_id = {w["c030Id"]: w for w in listing}
    assert by_id[w1["c030Id"]]["isDefault"] is False
    assert by_id[w2["c030Id"]]["isDefault"] is True


def test_delete_blocks_last_workspace(client, db_session):
    headers = _auth(client, db_session)
    ws = client.get("/api/layouts/stock/GOOG", headers=headers).json()[0]
    res = client.delete(f"/api/layouts/{ws['c030Id']}", headers=headers)
    assert res.status_code == 409


def test_delete_reassigns_default_and_keeps_related_data(client, db_session):
    headers = _auth(client, db_session)
    w1 = client.post(
        "/api/layouts/stock/META", json={"name": "Default-ish"}, headers=headers
    ).json()
    w2 = client.post(
        "/api/layouts/stock/META", json={"name": "Second"}, headers=headers
    ).json()
    c010 = w1["c010Id"]
    uid = _user_id(client, headers)

    # Datos relacionados que NO deben borrarse al eliminar un workspace.
    now = datetime.utcnow()
    drawing = AnalisisDibujo(
        C0101Id=1,
        C005Id=uid,
        C010Id=c010,
        TipoDibujo="free_line",
        TemporalidadOrigen="1Y_1d",
        PuntosJSON="[]",
        EstiloJSON="{}",
        FechaCreacion=now,
        FechaActualizacion=now,
    )
    trade = OperacionSimulada(
        C005Id=uid,
        C010Id=c010,
        TipoOperacion="LONG",
        PrecioEntrada=100.0,
        FechaEntrada=now,
        Estado="ABIERTA",
        FechaCreacion=now,
        FechaActualizacion=now,
    )
    db_session.add_all([drawing, trade])
    db_session.commit()

    # Borra el workspace default; el otro debe quedar como nuevo default.
    res = client.delete(f"/api/layouts/{w1['c030Id']}", headers=headers)
    assert res.status_code == 204

    remaining = client.get("/api/layouts/stock/META", headers=headers).json()
    assert len(remaining) == 1
    assert remaining[0]["c030Id"] == w2["c030Id"]
    assert remaining[0]["isDefault"] is True

    # Dibujo y operacion siguen existiendo.
    assert db_session.get(AnalisisDibujo, 1) is not None
    assert (
        db_session.query(OperacionSimulada)
        .filter_by(C010Id=c010)
        .count()
        == 1
    )


def test_global_default_layout_is_separate(client, db_session):
    """El layout global heredado (C010Id NULL) no se mezcla con workspaces."""
    headers = _auth(client, db_session)
    # Guarda preferencia global de UI.
    client.put(
        "/api/layouts/default",
        json={"chartTypeByPreset": {"1Y_1D": "line"}},
        headers=headers,
    )
    # Crea un workspace por accion.
    client.get("/api/layouts/stock/AAPL", headers=headers)

    got = client.get("/api/layouts/default", headers=headers)
    assert got.status_code == 200
    assert got.json()["chartTypeByPreset"]["1Y_1D"] == "line"

    workspaces = client.get("/api/layouts/stock/AAPL", headers=headers).json()
    assert len(workspaces) == 1
    assert workspaces[0]["name"] == "Default Analysis"


def test_rename_updates_name_and_config(client, db_session):
    headers = _auth(client, db_session)
    ws = client.get("/api/layouts/stock/INTC", headers=headers).json()[0]
    res = client.patch(
        f"/api/layouts/{ws['c030Id']}",
        json={"name": "  Largo plazo  "},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["name"] == "Largo plazo"  # recortado
    # Tambien refleja el nombre en ConfiguracionJSON.workspaceName.
    assert body["configuration"]["workspaceName"] == "Largo plazo"


def test_rename_empty_name_rejected(client, db_session):
    headers = _auth(client, db_session)
    ws = client.get("/api/layouts/stock/INTC", headers=headers).json()[0]
    blank = client.patch(
        f"/api/layouts/{ws['c030Id']}", json={"name": "   "}, headers=headers
    )
    assert blank.status_code == 400
    empty = client.patch(
        f"/api/layouts/{ws['c030Id']}", json={"name": ""}, headers=headers
    )
    assert empty.status_code == 422  # min_length de pydantic


def test_chart_slots_invalid_combo_is_repaired(client, db_session):
    headers = _auth(client, db_session)
    ws = client.get("/api/layouts/stock/QCOM", headers=headers).json()[0]
    # 5Y/1m no esta disponible: el backend repara el intervalo al default (1wk).
    res = client.patch(
        f"/api/layouts/{ws['c030Id']}/chart-slots",
        json={"chartSlots": [{"slotId": "chart_1", "range": "5Y", "interval": "1m"}]},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    slot1 = next(s for s in res.json()["chartSlots"] if s["slotId"] == "chart_1")
    assert slot1["range"] == "5Y"
    assert slot1["interval"] == "1wk"  # reparado, nunca 1m


def _user_id(client, headers) -> int:
    """Obtiene el C005Id del usuario autenticado via /auth/me."""
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["id"]
