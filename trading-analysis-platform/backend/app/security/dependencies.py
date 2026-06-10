"""Dependencias FastAPI de autenticacion/autorizacion.

- get_current_user: token valido + usuario existente.
- get_current_active_user: ademas Activo = 1.
- require_admin: ademas EsAdmin = 1.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.security.jwt import decode_access_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    if credentials is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    payload = decode_access_token(credentials.credentials)
    if payload is None or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    user = db.get(Usuario, int(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


def get_current_active_user(
    user: Usuario = Depends(get_current_user),
) -> Usuario:
    if not user.Activo:
        raise HTTPException(status_code=403, detail="Usuario desactivado")
    return user


def require_admin(
    user: Usuario = Depends(get_current_active_user),
) -> Usuario:
    if not user.EsAdmin:
        raise HTTPException(status_code=403, detail="Se requieren permisos de administrador")
    return user
