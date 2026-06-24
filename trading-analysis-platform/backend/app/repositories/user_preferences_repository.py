"""Repositorio de preferencias de usuario (C092). Clave/valor JSON por usuario,
acotado SIEMPRE por C005Id. Una sola fila ACTIVA por (C005Id, ClavePreferencia).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PreferenciaUsuario


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserPreferencesRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_active(self, user_id: int, clave: str) -> PreferenciaUsuario | None:
        return self.db.execute(
            select(PreferenciaUsuario).where(
                PreferenciaUsuario.C005Id == user_id,
                PreferenciaUsuario.ClavePreferencia == clave,
                PreferenciaUsuario.Activo == True,  # noqa: E712
            )
        ).scalar_one_or_none()

    def upsert(self, user_id: int, clave: str, valor_json: str) -> PreferenciaUsuario:
        """Crea o actualiza (en sitio) la preferencia activa del usuario."""
        existing = self.get_active(user_id, clave)
        now = _utcnow()
        if existing is not None:
            existing.ValorJSON = valor_json
            existing.FechaActualizacion = now
            self.db.flush()
            return existing
        pref = PreferenciaUsuario(
            C005Id=user_id,
            ClavePreferencia=clave,
            ValorJSON=valor_json,
            Activo=True,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(pref)
        self.db.flush()
        return pref

    def deactivate(self, user_id: int, clave: str) -> bool:
        """Borrado suave (reset al default del sistema). True si habia algo."""
        existing = self.get_active(user_id, clave)
        if existing is None:
            return False
        existing.Activo = False
        existing.FechaActualizacion = _utcnow()
        self.db.flush()
        return True
