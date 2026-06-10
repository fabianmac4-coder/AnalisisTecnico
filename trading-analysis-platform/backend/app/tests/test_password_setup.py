"""Flujo de set/reset de password via token de un solo uso."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select

from app.models import PasswordToken
from app.repositories.sql_utils import utcnow
from app.tests.conftest import login_headers, make_user


def _create_user_via_admin(client, db_session) -> dict:
    make_user(db_session, "Root", "root@example.com", es_admin=True)
    headers = login_headers(client, "Root")
    res = client.post(
        "/api/admin/users",
        json={"nombreUsuario": "Nuevo Usuario", "email": "nuevo@example.com", "esAdmin": False},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_admin_create_user_stores_token_hash_not_raw(client, db_session, caplog):
    import logging

    with caplog.at_level(logging.WARNING, logger="email_service"):
        created = _create_user_via_admin(client, db_session)
    assert created["debeCambiarPassword"] is True
    assert created["setupEmailSent"] is False  # SMTP no configurado en dev

    tokens = list(db_session.execute(select(PasswordToken)).scalars())
    assert len(tokens) == 1
    # En dev el link (con token crudo) se loguea; el hash guardado NO es el crudo.
    link_logs = [r.message for r in caplog.records if "set-password?token=" in r.message]
    assert link_logs, "en desarrollo el link debe loguearse"
    raw = link_logs[0].split("token=")[1]
    assert tokens[0].TokenHash != raw
    assert len(tokens[0].TokenHash) == 64  # HMAC-SHA256 hex


def _extract_raw_token(caplog) -> str:
    for record in caplog.records:
        if "set-password?token=" in record.message:
            return record.message.split("token=")[1]
    raise AssertionError("no se logueo el link de setup")


def test_set_password_full_flow(client, db_session, caplog):
    import logging

    with caplog.at_level(logging.WARNING, logger="email_service"):
        _create_user_via_admin(client, db_session)
    raw = _extract_raw_token(caplog)

    # validate-password-token
    res = client.get(f"/api/auth/validate-password-token?token={raw}")
    assert res.status_code == 200
    body = res.json()
    assert body["valid"] is True
    assert body["tipoToken"] == "SET_PASSWORD"
    assert "***" in body["email"]  # enmascarado

    # set-password con password debil -> 400
    weak = client.post(
        "/api/auth/set-password", json={"token": raw, "newPassword": "corta"}
    )
    assert weak.status_code == 400

    # set-password valida
    res = client.post(
        "/api/auth/set-password", json={"token": raw, "newPassword": "NuevaClave123"}
    )
    assert res.status_code == 200
    assert res.json()["success"] is True

    # token queda usado: segunda vez falla
    again = client.post(
        "/api/auth/set-password", json={"token": raw, "newPassword": "OtraClave123"}
    )
    assert again.status_code == 400

    # y ahora puede loguearse con la nueva password
    login = client.post(
        "/api/auth/login",
        json={"username": "nuevo@example.com", "password": "NuevaClave123"},
    )
    assert login.status_code == 200
    assert login.json()["user"]["debeCambiarPassword"] is False


def test_set_password_invalid_and_expired_tokens(client, db_session, caplog):
    import logging

    res = client.post(
        "/api/auth/set-password", json={"token": "token-falso", "newPassword": "Clave1234"}
    )
    assert res.status_code == 400

    with caplog.at_level(logging.WARNING, logger="email_service"):
        _create_user_via_admin(client, db_session)
    raw = _extract_raw_token(caplog)

    # Expira el token manualmente.
    token = db_session.execute(select(PasswordToken)).scalars().first()
    token.FechaExpiracion = utcnow() - timedelta(hours=1)
    db_session.commit()

    res = client.post(
        "/api/auth/set-password", json={"token": raw, "newPassword": "Clave1234"}
    )
    assert res.status_code == 400
    assert client.get(f"/api/auth/validate-password-token?token={raw}").json()["valid"] is False
