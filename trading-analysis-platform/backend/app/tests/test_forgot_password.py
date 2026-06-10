"""Tests de recuperación de contraseña desde el login (forgot/reset)."""
from __future__ import annotations

import logging
import re
from datetime import timedelta

from sqlalchemy import select

from app.models import PasswordToken, Usuario
from app.repositories.sql_utils import utcnow
from app.tests.conftest import make_user

LINK_RE = re.compile(r"reset-password\?token=([A-Za-z0-9_\-]+)")


def _request_reset(client, caplog, email: str):
    """Dispara forgot-password y devuelve (response, raw_token|None del log)."""
    caplog.set_level(logging.WARNING, logger="email_service")
    caplog.clear()
    res = client.post("/api/auth/forgot-password", json={"email": email})
    match = LINK_RE.search(caplog.text)
    return res, (match.group(1) if match else None)


def _tokens_for(db, user_id: int) -> list[PasswordToken]:
    return list(
        db.execute(select(PasswordToken).where(PasswordToken.C005Id == user_id)).scalars()
    )


def test_forgot_password_active_email_creates_reset_token(client, db_session, caplog):
    user = make_user(db_session, "Ana", "ana@example.com")
    res, raw = _request_reset(client, caplog, "ana@example.com")
    assert res.status_code == 200
    assert res.json() == {"success": True, "message": "Password recovery email sent."}

    tokens = _tokens_for(db_session, user.C005Id)
    assert len(tokens) == 1
    token = tokens[0]
    assert token.TipoToken == "RESET_PASSWORD"
    assert token.Usado is False
    assert token.FechaExpiracion > utcnow()
    # Solo se guarda el hash: el token crudo del link no aparece en la BD.
    assert raw is not None
    assert token.TokenHash != raw


def test_forgot_password_logs_reset_link_in_dev(client, db_session, caplog):
    make_user(db_session, "Ana", "ana@example.com")
    _, raw = _request_reset(client, caplog, "ana@example.com")
    assert raw is not None  # sin SMTP, el link /reset-password se loguea


def test_forgot_password_unknown_email_404_and_no_side_effects(client, db_session, caplog):
    make_user(db_session, "Ana", "ana@example.com")
    users_before = len(list(db_session.execute(select(Usuario)).scalars()))
    res, raw = _request_reset(client, caplog, "nadie@example.com")
    assert res.status_code == 404
    assert res.json()["detail"] == "No active user exists with that email."
    # No crea usuarios ni tokens.
    assert len(list(db_session.execute(select(Usuario)).scalars())) == users_before
    assert len(list(db_session.execute(select(PasswordToken)).scalars())) == 0
    assert raw is None


def test_forgot_password_inactive_user_403_and_no_token(client, db_session, caplog):
    user = make_user(db_session, "Inactivo", "inactivo@example.com", activo=False)
    res, raw = _request_reset(client, caplog, "inactivo@example.com")
    assert res.status_code == 403
    assert res.json()["detail"] == "This user is inactive. Contact the administrator."
    assert _tokens_for(db_session, user.C005Id) == []
    assert raw is None


def test_reset_password_full_flow_and_login_with_new_password(client, db_session, caplog):
    make_user(db_session, "Ana", "ana@example.com", password="Antigua123")
    _, raw = _request_reset(client, caplog, "ana@example.com")

    # validate antes de usar.
    val = client.get(f"/api/auth/validate-password-token?token={raw}").json()
    assert val["valid"] is True
    assert val["tipoToken"] == "RESET_PASSWORD"
    assert val["email"] == "a***@example.com"

    res = client.post(
        "/api/auth/reset-password", json={"token": raw, "newPassword": "Nueva1234"}
    )
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Login con la nueva, y la vieja ya no sirve.
    assert (
        client.post("/api/auth/login", json={"username": "Ana", "password": "Nueva1234"}).status_code
        == 200
    )
    assert (
        client.post("/api/auth/login", json={"username": "Ana", "password": "Antigua123"}).status_code
        == 401
    )


def test_reset_password_token_is_one_time(client, db_session, caplog):
    make_user(db_session, "Ana", "ana@example.com")
    _, raw = _request_reset(client, caplog, "ana@example.com")
    first = client.post(
        "/api/auth/reset-password", json={"token": raw, "newPassword": "Nueva1234"}
    )
    assert first.status_code == 200

    # Reuso: validate dice invalido y reset devuelve 400.
    val = client.get(f"/api/auth/validate-password-token?token={raw}").json()
    assert val == {"valid": False, "tipoToken": None, "email": None, "reason": "invalid_or_expired"}
    again = client.post(
        "/api/auth/reset-password", json={"token": raw, "newPassword": "Otra12345"}
    )
    assert again.status_code == 400


def test_reset_password_expired_token_fails(client, db_session, caplog):
    user = make_user(db_session, "Ana", "ana@example.com")
    _, raw = _request_reset(client, caplog, "ana@example.com")
    token = _tokens_for(db_session, user.C005Id)[0]
    token.FechaExpiracion = utcnow() - timedelta(minutes=1)
    db_session.commit()

    res = client.post(
        "/api/auth/reset-password", json={"token": raw, "newPassword": "Nueva1234"}
    )
    assert res.status_code == 400


def test_reset_password_invalid_token_fails(client, db_session):
    res = client.post(
        "/api/auth/reset-password",
        json={"token": "token-falso", "newPassword": "Nueva1234"},
    )
    assert res.status_code == 400


def test_reset_password_rejects_weak_password(client, db_session, caplog):
    make_user(db_session, "Ana", "ana@example.com")
    _, raw = _request_reset(client, caplog, "ana@example.com")
    res = client.post("/api/auth/reset-password", json={"token": raw, "newPassword": "abc"})
    assert res.status_code == 400


def test_reset_password_blocked_for_inactive_user(client, db_session, caplog):
    user = make_user(db_session, "Ana", "ana@example.com")
    _, raw = _request_reset(client, caplog, "ana@example.com")
    user.Activo = False
    db_session.commit()
    res = client.post(
        "/api/auth/reset-password", json={"token": raw, "newPassword": "Nueva1234"}
    )
    assert res.status_code == 403


# ===== change-password (autenticado) =====


def test_change_password_requires_current_password(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    login = client.post(
        "/api/auth/login", json={"username": "Ana", "password": "Password123"}
    ).json()
    headers = {"Authorization": f"Bearer {login['accessToken']}"}

    bad = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "Equivocada1", "newPassword": "Nueva1234"},
        headers=headers,
    )
    assert bad.status_code == 400

    ok = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "Password123", "newPassword": "Nueva1234"},
        headers=headers,
    )
    assert ok.status_code == 200
    assert (
        client.post("/api/auth/login", json={"username": "Ana", "password": "Nueva1234"}).status_code
        == 200
    )
