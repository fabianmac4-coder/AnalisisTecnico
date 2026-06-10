"""Tests de Mi Cuenta: cambio de contraseña propio y edición de perfil."""
from __future__ import annotations

from app.models import Usuario
from app.security.password import verify_password
from app.tests.conftest import login_headers, make_user


def test_user_can_change_own_password(client, db_session):
    user = make_user(db_session, "Ana", "ana@example.com", debe_cambiar=True)
    headers = login_headers(client, "Ana")

    res = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "Password123", "newPassword": "Nueva1234"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert "PasswordHash" not in res.text

    db_session.expire_all()
    refreshed = db_session.get(Usuario, user.C005Id)
    # Cambia el hash y limpia el flag de cambio forzado.
    assert verify_password("Nueva1234", refreshed.PasswordHash)
    assert bool(refreshed.DebeCambiarPassword) is False

    # La nueva funciona, la vieja no.
    assert (
        client.post("/api/auth/login", json={"username": "Ana", "password": "Nueva1234"}).status_code
        == 200
    )
    assert (
        client.post("/api/auth/login", json={"username": "Ana", "password": "Password123"}).status_code
        == 401
    )


def test_change_password_wrong_current_fails(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    res = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "Equivocada1", "newPassword": "Nueva1234"},
        headers=headers,
    )
    assert res.status_code == 400


def test_change_password_weak_new_fails(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    res = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "Password123", "newPassword": "corta"},
        headers=headers,
    )
    assert res.status_code == 400


def test_change_password_only_affects_own_user(client, db_session):
    """El endpoint no recibe user_id: solo puede tocar al usuario del JWT."""
    make_user(db_session, "Ana", "ana@example.com")
    otro = make_user(db_session, "Otro", "otro@example.com")
    headers = login_headers(client, "Ana")
    client.post(
        "/api/auth/change-password",
        json={"currentPassword": "Password123", "newPassword": "Nueva1234"},
        headers=headers,
    )
    db_session.expire_all()
    refreshed = db_session.get(Usuario, otro.C005Id)
    assert verify_password("Password123", refreshed.PasswordHash)  # intacto


def test_change_password_requires_auth(client, db_session):
    res = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "x1234567", "newPassword": "Nueva1234"},
    )
    assert res.status_code == 401


# ===== PATCH /auth/me (perfil propio) =====


def test_update_me_name_and_email(client, db_session):
    user = make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    res = client.patch(
        "/api/auth/me",
        json={"nombreUsuario": "Ana Maria", "email": "ana.maria@example.com"},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["nombreUsuario"] == "Ana Maria"
    assert body["email"] == "ana.maria@example.com"
    assert "PasswordHash" not in res.text
    db_session.expire_all()
    assert db_session.get(Usuario, user.C005Id).NombreUsuario == "Ana Maria"


def test_update_me_rejects_duplicates(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    make_user(db_session, "Beto", "beto@example.com")
    headers = login_headers(client, "Ana")
    assert (
        client.patch("/api/auth/me", json={"nombreUsuario": "Beto"}, headers=headers).status_code
        == 409
    )
    assert (
        client.patch("/api/auth/me", json={"email": "beto@example.com"}, headers=headers).status_code
        == 409
    )


def test_update_me_cannot_escalate_privileges(client, db_session):
    """Campos extra como esAdmin/activo se ignoran (no están en el schema)."""
    user = make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    res = client.patch(
        "/api/auth/me",
        json={"nombreUsuario": "Ana", "esAdmin": True, "activo": False},
        headers=headers,
    )
    assert res.status_code == 200
    db_session.expire_all()
    refreshed = db_session.get(Usuario, user.C005Id)
    assert bool(refreshed.EsAdmin) is False
    assert bool(refreshed.Activo) is True


# ===== Acceso admin =====


def test_non_admin_cannot_list_users(client, db_session):
    make_user(db_session, "Normal", "normal@example.com")
    headers = login_headers(client, "Normal")
    assert client.get("/api/admin/users", headers=headers).status_code == 403


def test_admin_can_list_users(client, db_session):
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    headers = login_headers(client, "Root")
    res = client.get("/api/admin/users", headers=headers)
    assert res.status_code == 200
    assert "PasswordHash" not in res.text
