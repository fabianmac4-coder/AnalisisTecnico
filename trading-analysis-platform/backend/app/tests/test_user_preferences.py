"""Pruebas de la plantilla de gráficas por defecto (C092, /api/user-preferences)."""
from __future__ import annotations

from app.chart_workspaces import DEFAULT_CHART_SLOTS
from app.models import PreferenciaUsuario
from app.tests.conftest import login_headers, make_user

TEMPLATE_URL = "/api/user-preferences/default-chart-layout-template"


def _auth(client, db, username="pref_user", email="pref@example.com"):
    make_user(db, username, email)
    return login_headers(client, username)


def _six_slots(**overrides) -> list[dict]:
    """Seis slots válidos (default del sistema) con sobreescrituras por slotId."""
    slots = [dict(s) for s in DEFAULT_CHART_SLOTS]
    for slot_id, patch in overrides.items():
        for s in slots:
            if s["slotId"] == slot_id:
                s.update(patch)
    return slots


def test_get_returns_system_default_when_no_template(client, db_session):
    headers = _auth(client, db_session)
    res = client.get(TEMPLATE_URL, headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["source"] == "SYSTEM"
    assert body["isUserTemplate"] is False
    assert len(body["chartSlots"]) == 6
    assert body["chartSlots"][0]["slotId"] == "chart_1"
    assert body["chartSlots"][0]["range"] == "5Y"


def test_post_saves_template_then_get_returns_it(client, db_session):
    headers = _auth(client, db_session)
    slots = _six_slots(chart_1={"range": "1Y", "interval": "1h"})
    res = client.post(TEMPLATE_URL, json={"chartSlots": slots}, headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["source"] == "USER"
    assert res.json()["isUserTemplate"] is True

    got = client.get(TEMPLATE_URL, headers=headers).json()
    assert got["source"] == "USER"
    assert got["isUserTemplate"] is True
    slot1 = next(s for s in got["chartSlots"] if s["slotId"] == "chart_1")
    assert slot1["range"] == "1Y"
    assert slot1["interval"] == "1h"


def test_post_upsert_replaces_in_place(client, db_session):
    headers = _auth(client, db_session)
    client.post(
        TEMPLATE_URL,
        json={"chartSlots": _six_slots(chart_1={"range": "1Y", "interval": "1h"})},
        headers=headers,
    )
    client.post(
        TEMPLATE_URL,
        json={"chartSlots": _six_slots(chart_1={"range": "6M", "interval": "30m"})},
        headers=headers,
    )
    # Solo una fila activa para la clave.
    rows = (
        db_session.query(PreferenciaUsuario)
        .filter(
            PreferenciaUsuario.ClavePreferencia == "DEFAULT_CHART_LAYOUT_TEMPLATE",
            PreferenciaUsuario.Activo == True,  # noqa: E712
        )
        .all()
    )
    assert len(rows) == 1
    got = client.get(TEMPLATE_URL, headers=headers).json()
    slot1 = next(s for s in got["chartSlots"] if s["slotId"] == "chart_1")
    assert slot1["range"] == "6M"


def test_post_rejects_wrong_number_of_slots(client, db_session):
    headers = _auth(client, db_session)
    res = client.post(
        TEMPLATE_URL,
        json={"chartSlots": _six_slots()[:5]},
        headers=headers,
    )
    assert res.status_code == 422, res.text


def test_post_rejects_wrong_slot_id(client, db_session):
    headers = _auth(client, db_session)
    slots = _six_slots()
    slots[0]["slotId"] = "chart_X"
    res = client.post(TEMPLATE_URL, json={"chartSlots": slots}, headers=headers)
    assert res.status_code == 422, res.text


def test_post_rejects_invalid_range_interval_combo(client, db_session):
    headers = _auth(client, db_session)
    # 5Y solo admite 1mo/1wk/1d -> 5m es inválido.
    slots = _six_slots(chart_1={"range": "5Y", "interval": "5m"})
    res = client.post(TEMPLATE_URL, json={"chartSlots": slots}, headers=headers)
    assert res.status_code == 422, res.text


def test_delete_resets_to_system_default(client, db_session):
    headers = _auth(client, db_session)
    client.post(
        TEMPLATE_URL,
        json={"chartSlots": _six_slots(chart_1={"range": "1Y", "interval": "1h"})},
        headers=headers,
    )
    res = client.delete(TEMPLATE_URL, headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["source"] == "SYSTEM"
    assert res.json()["isUserTemplate"] is False

    got = client.get(TEMPLATE_URL, headers=headers).json()
    assert got["source"] == "SYSTEM"
    assert got["isUserTemplate"] is False
    assert got["chartSlots"][0]["range"] == "5Y"


def test_template_scoped_per_user(client, db_session):
    a = _auth(client, db_session, "alice", "alice@example.com")
    client.post(
        TEMPLATE_URL,
        json={"chartSlots": _six_slots(chart_1={"range": "1Y", "interval": "1h"})},
        headers=a,
    )
    make_user(db_session, "bob", "bob@example.com")
    b = login_headers(client, "bob")
    got = client.get(TEMPLATE_URL, headers=b).json()
    # Bob no ve la plantilla de Alice.
    assert got["isUserTemplate"] is False
    assert got["chartSlots"][0]["range"] == "5Y"


def test_new_stock_workspace_uses_saved_template(client, db_session):
    headers = _auth(client, db_session)
    client.post(
        TEMPLATE_URL,
        json={"chartSlots": _six_slots(chart_1={"range": "1Y", "interval": "1h"})},
        headers=headers,
    )
    # Stock abierto por PRIMERA vez -> usa la plantilla.
    res = client.get("/api/layouts/stock/AAPL", headers=headers)
    assert res.status_code == 200, res.text
    ws = res.json()[0]
    slot1 = next(s for s in ws["chartSlots"] if s["slotId"] == "chart_1")
    assert slot1["range"] == "1Y"
    assert slot1["interval"] == "1h"


def test_new_workspace_from_scratch_uses_template(client, db_session):
    headers = _auth(client, db_session)
    client.post(
        TEMPLATE_URL,
        json={"chartSlots": _six_slots(chart_2={"range": "6M", "interval": "30m"})},
        headers=headers,
    )
    # Crea uno desde cero (sin copyFrom) -> plantilla.
    res = client.post(
        "/api/layouts/stock/MSFT", json={"name": "Nuevo"}, headers=headers
    )
    assert res.status_code == 201, res.text
    slot2 = next(s for s in res.json()["chartSlots"] if s["slotId"] == "chart_2")
    assert slot2["range"] == "6M"
    assert slot2["interval"] == "30m"


def test_duplicate_ignores_template_and_copies_source(client, db_session):
    headers = _auth(client, db_session)
    # Plantilla del usuario distinta del workspace base.
    client.post(
        TEMPLATE_URL,
        json={"chartSlots": _six_slots(chart_1={"range": "1Y", "interval": "1h"})},
        headers=headers,
    )
    base = client.post(
        "/api/layouts/stock/NVDA", json={"name": "Base"}, headers=headers
    ).json()
    c030 = base["c030Id"]
    # El workspace base usó la plantilla (chart_1 = 1Y/1h). Cámbialo a algo único.
    client.patch(
        f"/api/layouts/{c030}/chart-slots",
        json={"chartSlots": [{"slotId": "chart_1", "range": "3M", "interval": "15m"}]},
        headers=headers,
    )
    dup = client.post(
        "/api/layouts/stock/NVDA",
        json={"name": "Base copy", "copyFromC030Id": c030},
        headers=headers,
    )
    assert dup.status_code == 201, dup.text
    slot1 = next(s for s in dup.json()["chartSlots"] if s["slotId"] == "chart_1")
    # Copia el ORIGEN (3M/15m), no la plantilla (1Y/1h).
    assert slot1["range"] == "3M"
    assert slot1["interval"] == "15m"


def test_existing_workspace_not_overwritten_by_template_change(client, db_session):
    headers = _auth(client, db_session)
    # Crea el workspace con el default del sistema.
    res = client.get("/api/layouts/stock/AMZN", headers=headers)
    c030 = res.json()[0]["c030Id"]
    # Ahora guarda una plantilla distinta.
    client.post(
        TEMPLATE_URL,
        json={"chartSlots": _six_slots(chart_1={"range": "1Y", "interval": "1h"})},
        headers=headers,
    )
    # El workspace ya existente NO cambia.
    again = client.get("/api/layouts/stock/AMZN", headers=headers).json()
    ws = next(w for w in again if w["c030Id"] == c030)
    slot1 = next(s for s in ws["chartSlots"] if s["slotId"] == "chart_1")
    assert slot1["range"] == "5Y"  # sigue el default del sistema


def test_hard_delete_removes_user_preferences(client, db_session):
    """El hard-delete del admin borra también las preferencias C092 del usuario."""
    from app.models import Usuario
    from app.repositories.user_preferences_repository import (
        UserPreferencesRepository,
    )
    from app.repositories.users_repository import UsersRepository

    make_user(db_session, "victim", "victim@example.com")
    user = (
        db_session.query(Usuario)
        .filter(Usuario.NombreUsuario == "victim")
        .one()
    )
    UserPreferencesRepository(db_session).upsert(
        user.C005Id, "DEFAULT_CHART_LAYOUT_TEMPLATE", "{}"
    )
    db_session.flush()

    UsersRepository(db_session).hard_delete_user(user)
    db_session.flush()

    remaining = (
        db_session.query(PreferenciaUsuario)
        .filter(PreferenciaUsuario.C005Id == user.C005Id)
        .all()
    )
    assert remaining == []
