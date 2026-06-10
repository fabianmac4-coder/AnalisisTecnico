"""Tokens de un solo uso para set/reset de password.

- El token CRUDO solo viaja en el link del correo.
- En base de datos solo se guarda su hash (HMAC-SHA256 con el secreto JWT).
- Nunca loguear el token crudo en produccion.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets

from app.config import env_settings

SET_PASSWORD_EXPIRE_HOURS = 24
RESET_PASSWORD_EXPIRE_HOURS = 1

TOKEN_TYPE_SET = "SET_PASSWORD"
TOKEN_TYPE_RESET = "RESET_PASSWORD"


def generate_raw_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(raw_token: str) -> str:
    return hmac.new(
        env_settings.JWT_SECRET_KEY.encode("utf-8"),
        raw_token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_token(raw_token: str, token_hash: str) -> bool:
    return hmac.compare_digest(hash_token(raw_token), token_hash)
