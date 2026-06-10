"""Tests de autenticacion: login, /me, salud de BD y reglas de acceso."""
from __future__ import annotations

from app.tests.conftest import login_headers, make_user


def test_health_db_works(client):
    res = client.get("/api/health/db")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_login_success_returns_token_and_user(client, db_session):
    make_user(db_session, "Juan Perez", "juan@example.com")
    res = client.post(
        "/api/auth/login", json={"username": "Juan Perez", "password": "Password123"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["accessToken"]
    assert body["tokenType"] == "bearer"
    assert body["user"]["nombreUsuario"] == "Juan Perez"
    assert "PasswordHash" not in res.text
    assert "passwordHash" not in res.text


def test_login_accepts_email(client, db_session):
    make_user(db_session, "Maria", "maria@example.com")
    res = client.post(
        "/api/auth/login", json={"username": "MARIA@example.com", "password": "Password123"}
    )
    assert res.status_code == 200


def test_login_wrong_password(client, db_session):
    make_user(db_session, "Juan", "juan@example.com")
    res = client.post("/api/auth/login", json={"username": "Juan", "password": "mala"})
    assert res.status_code == 401


def test_login_unknown_user(client):
    res = client.post("/api/auth/login", json={"username": "nadie", "password": "x12345678"})
    assert res.status_code == 401


def test_inactive_user_cannot_login(client, db_session):
    make_user(db_session, "Inactivo", "off@example.com", activo=False)
    res = client.post(
        "/api/auth/login", json={"username": "Inactivo", "password": "Password123"}
    )
    assert res.status_code == 403


def test_user_with_pending_password_can_login_but_is_flagged(client, db_session):
    """DebeCambiarPassword=1 ya NO bloquea el login: se emite el JWT y el
    frontend fuerza /change-password con el flag debeCambiarPassword."""
    make_user(db_session, "Nuevo", "nuevo@example.com", debe_cambiar=True)
    res = client.post(
        "/api/auth/login", json={"username": "Nuevo", "password": "Password123"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["debeCambiarPassword"] is True
    assert body["accessToken"]


def test_me_requires_token_and_returns_user(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    assert client.get("/api/auth/me").status_code == 401
    headers = login_headers(client, "Ana")
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["nombreUsuario"] == "Ana"
    assert body["activo"] is True
    assert "PasswordHash" not in res.text


def test_protected_endpoints_reject_unauthenticated(client):
    assert client.get("/api/drawings?symbol=AAPL").status_code == 401
    assert client.get("/api/catalog").status_code == 401
    assert client.get("/api/layouts/default").status_code == 401
    assert client.get("/api/indicators").status_code == 401
    assert client.get("/api/admin/users").status_code == 401
