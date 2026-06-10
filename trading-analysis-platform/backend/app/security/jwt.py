"""Creacion y verificacion de JWT (python-jose).

Payload: sub (C005Id como str), username, is_admin, exp.
El secreto viene SIEMPRE de variables de entorno (JWT_SECRET_KEY).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.config import env_settings


def create_access_token(
    data: dict[str, Any], expires_delta: timedelta | None = None
) -> str:
    to_encode = dict(data)
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=env_settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(
        to_encode, env_settings.JWT_SECRET_KEY, algorithm=env_settings.JWT_ALGORITHM
    )


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Devuelve el payload o None si el token es invalido/expirado."""
    try:
        return jwt.decode(
            token,
            env_settings.JWT_SECRET_KEY,
            algorithms=[env_settings.JWT_ALGORITHM],
        )
    except JWTError:
        return None
