"""Pruebas de configuracion del Stock Scorecard (dbo.C081, /api/scorecard/*)."""
from __future__ import annotations

from app.tests.conftest import login_headers, make_user


def _auth(client, db, username="cfg_user", email="cfg@example.com"):
    make_user(db, username, email)
    return login_headers(client, username)


def test_default_config_created_if_missing(client, db_session):
    headers = _auth(client, db_session)
    res = client.get("/api/scorecard/configs/default", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["isDefault"] is True
    assert body["name"] == "Default"
    # La config viene COMPLETA (pesos + umbrales).
    assert body["configuration"]["weights"]["technical"] == 40
    assert "peRatio" in body["configuration"]["fundamentals"]


def test_list_configs_creates_default(client, db_session):
    headers = _auth(client, db_session)
    res = client.get("/api/scorecard/configs", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_update_config(client, db_session):
    headers = _auth(client, db_session)
    cfg = client.get("/api/scorecard/configs/default", headers=headers).json()
    config = cfg["configuration"]
    config["fundamentals"]["roe"]["excellentMin"] = 25
    res = client.patch(
        f"/api/scorecard/configs/{cfg['c081Id']}",
        json={"name": "Mi config", "configuration": config},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["name"] == "Mi config"
    assert body["configuration"]["fundamentals"]["roe"]["excellentMin"] == 25


def test_partial_config_is_merged_with_default(client, db_session):
    headers = _auth(client, db_session)
    cfg = client.get("/api/scorecard/configs/default", headers=headers).json()
    # Manda solo un fragmento (umbral): el resto se completa con el default.
    res = client.patch(
        f"/api/scorecard/configs/{cfg['c081Id']}",
        json={"configuration": {"fundamentals": {"peRatio": {"excellentMax": 12}}}},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["configuration"]["fundamentals"]["peRatio"]["excellentMax"] == 12
    assert body["configuration"]["weights"]["technical"] == 40  # del default
    assert "sentiment" in body["configuration"]  # sección de sentimiento presente


def test_invalid_weights_total_rejected(client, db_session):
    headers = _auth(client, db_session)
    cfg = client.get("/api/scorecard/configs/default", headers=headers).json()
    config = cfg["configuration"]
    config["weights"] = {"technical": 50, "fundamentals": 30, "news": 20, "sentiment": 10}
    res = client.patch(
        f"/api/scorecard/configs/{cfg['c081Id']}",
        json={"configuration": config},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"]["error"] == "INVALID_SCORECARD_CONFIG"
    assert "100" in res.json()["detail"]["message"]


def test_reset_default_config(client, db_session):
    headers = _auth(client, db_session)
    cfg = client.get("/api/scorecard/configs/default", headers=headers).json()
    config = cfg["configuration"]
    config["fundamentals"]["peRatio"]["excellentMax"] = 99
    client.patch(
        f"/api/scorecard/configs/{cfg['c081Id']}",
        json={"configuration": config},
        headers=headers,
    )
    res = client.post("/api/scorecard/configs/reset-default", headers=headers)
    assert res.status_code == 200
    assert res.json()["configuration"]["fundamentals"]["peRatio"]["excellentMax"] == 10


def test_config_scoped_per_user(client, db_session):
    a = _auth(client, db_session, "alice_cfg", "alice_cfg@example.com")
    cfg_a = client.get("/api/scorecard/configs/default", headers=a).json()

    make_user(db_session, "bob_cfg", "bob_cfg@example.com")
    b = login_headers(client, "bob_cfg")
    # Bob no puede leer/editar la config de Alice.
    res = client.patch(
        f"/api/scorecard/configs/{cfg_a['c081Id']}",
        json={"name": "hack"},
        headers=b,
    )
    assert res.status_code == 404


def test_create_and_set_default_and_delete(client, db_session):
    headers = _auth(client, db_session)
    client.get("/api/scorecard/configs/default", headers=headers)  # crea Default
    created = client.post(
        "/api/scorecard/configs", json={"name": "Agresiva"}, headers=headers
    )
    assert created.status_code == 201, created.text
    new_id = created.json()["c081Id"]
    assert created.json()["isDefault"] is False

    set_def = client.patch(
        f"/api/scorecard/configs/{new_id}/set-default", headers=headers
    )
    assert set_def.status_code == 200
    assert set_def.json()["isDefault"] is True

    # No se puede borrar la ultima; con dos, si.
    res = client.delete(f"/api/scorecard/configs/{new_id}", headers=headers)
    assert res.status_code == 204
    remaining = client.get("/api/scorecard/configs", headers=headers).json()
    assert len(remaining) == 1


def test_delete_last_config_blocked(client, db_session):
    headers = _auth(client, db_session)
    cfg = client.get("/api/scorecard/configs/default", headers=headers).json()
    res = client.delete(f"/api/scorecard/configs/{cfg['c081Id']}", headers=headers)
    assert res.status_code == 409
