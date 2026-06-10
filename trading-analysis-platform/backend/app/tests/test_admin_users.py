"""Tests de administracion de usuarios y aislamiento de datos por usuario."""
from __future__ import annotations

from app.tests.conftest import login_headers, make_user


def test_non_admin_cannot_manage_users(client, db_session):
    make_user(db_session, "Normal", "normal@example.com")
    headers = login_headers(client, "Normal")
    assert client.get("/api/admin/users", headers=headers).status_code == 403
    res = client.post(
        "/api/admin/users",
        json={"nombreUsuario": "X", "email": "x@example.com", "esAdmin": False},
        headers=headers,
    )
    assert res.status_code == 403


def test_admin_can_list_create_and_edit_users(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    headers = login_headers(client, "Root")

    created = client.post(
        "/api/admin/users",
        json={"nombreUsuario": "Empleado", "email": "emp@example.com", "esAdmin": False},
        headers=headers,
    )
    assert created.status_code == 201
    uid = created.json()["id"]
    assert "PasswordHash" not in created.text

    listed = client.get("/api/admin/users", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 2
    assert "PasswordHash" not in listed.text

    # Duplicados rechazados
    dup = client.post(
        "/api/admin/users",
        json={"nombreUsuario": "EMPLEADO", "email": "otro@example.com", "esAdmin": False},
        headers=headers,
    )
    assert dup.status_code == 409

    edited = client.patch(
        f"/api/admin/users/{uid}",
        json={"nombreUsuario": "Empleado Editado", "esAdmin": True},
        headers=headers,
    )
    assert edited.status_code == 200
    assert edited.json()["nombreUsuario"] == "Empleado Editado"
    assert edited.json()["esAdmin"] is True


def test_cannot_deactivate_or_demote_last_active_admin(client, db_session):
    admin = make_user(db_session, "Root", "root@example.com", es_admin=True)
    headers = login_headers(client, "Root")

    demote = client.patch(
        f"/api/admin/users/{admin.C005Id}", json={"esAdmin": False}, headers=headers
    )
    assert demote.status_code == 400

    deactivate = client.patch(
        f"/api/admin/users/{admin.C005Id}", json={"activo": False}, headers=headers
    )
    assert deactivate.status_code == 400

    deleted = client.delete(f"/api/admin/users/{admin.C005Id}", headers=headers)
    assert deleted.status_code == 400


def test_admin_can_deactivate_regular_user_soft(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    user = make_user(db_session, "Temp", "temp@example.com")
    headers = login_headers(client, "Root")

    res = client.delete(f"/api/admin/users/{user.C005Id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["activo"] is False
    # Soft delete: sigue listado.
    assert any(u["id"] == user.C005Id for u in client.get("/api/admin/users", headers=headers).json())


def test_send_password_reset_marks_user(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    user = make_user(db_session, "Olvido", "olvido@example.com")
    headers = login_headers(client, "Root")

    res = client.post(
        f"/api/admin/users/{user.C005Id}/send-password-reset", headers=headers
    )
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert res.json()["resetEmailSent"] is False  # dev sin SMTP

    # El usuario aun puede loguear con su password actual, pero queda marcado
    # para cambio forzado (/change-password en el frontend).
    login = client.post(
        "/api/auth/login", json={"username": "Olvido", "password": "Password123"}
    )
    assert login.status_code == 200
    assert login.json()["user"]["debeCambiarPassword"] is True


# ===== Aislamiento de datos por usuario (C005Id) =====


def _drawing_payload(symbol: str = "AAPL") -> dict:
    return {
        "symbol": symbol,
        "sourceTimeframe": "1Y_1D",
        "type": "free_line",
        "points": [{"time": 1, "price": 1}, {"time": 2, "price": 2}],
        "style": {"color": "#fff", "width": 2, "lineStyle": "solid", "opacity": 1},
        "visible": True,
        "locked": False,
        "showOnAllTimeframes": True,
        "version": 3,
    }


def test_user_data_is_isolated_by_user(client, db_session):
    make_user(db_session, "UserA", "a@example.com")
    make_user(db_session, "UserB", "b@example.com")
    ha = login_headers(client, "UserA")
    hb = login_headers(client, "UserB")

    # Dibujos
    created = client.post("/api/drawings", json=_drawing_payload(), headers=ha)
    assert created.status_code == 201
    assert len(client.get("/api/drawings?symbol=AAPL", headers=ha).json()) == 1
    assert client.get("/api/drawings?symbol=AAPL", headers=hb).json() == []

    # B no puede tocar el dibujo de A
    drawing_id = created.json()["id"]
    patch = client.patch(f"/api/drawings/{drawing_id}", json=_drawing_payload(), headers=hb)
    assert patch.status_code == 404

    # Catalogo
    client.post("/api/catalog", json={"symbol": "AAPL"}, headers=ha)
    assert len(client.get("/api/catalog", headers=ha).json()) == 1
    assert client.get("/api/catalog", headers=hb).json() == []

    # Layout
    client.put("/api/layouts/default", json={"theme": "dark"}, headers=ha)
    assert client.get("/api/layouts/default", headers=ha).status_code == 200
    assert client.get("/api/layouts/default", headers=hb).status_code == 404

    # Indicadores
    client.put(
        "/api/indicators",
        json=[{
            "id": "sma-20", "type": "SMA", "name": "SMA 20", "visible": True,
            "applyToAllTimeframes": True, "params": {"period": 20}, "style": {},
        }],
        headers=ha,
    )
    assert len(client.get("/api/indicators", headers=ha).json()) == 1
    assert client.get("/api/indicators", headers=hb).json() == []


def test_drawing_delete_is_soft(client, db_session):
    make_user(db_session, "UserA", "a@example.com")
    ha = login_headers(client, "UserA")
    created = client.post("/api/drawings", json=_drawing_payload(), headers=ha)
    drawing_id = created.json()["id"]
    assert client.delete(f"/api/drawings/{drawing_id}", headers=ha).status_code == 204
    assert client.get("/api/drawings?symbol=AAPL", headers=ha).json() == []

    from sqlalchemy import select

    from app.models import AnalisisDibujo

    row = db_session.execute(select(AnalisisDibujo)).scalars().first()
    assert row is not None and row.Eliminado is True  # sigue en la tabla
