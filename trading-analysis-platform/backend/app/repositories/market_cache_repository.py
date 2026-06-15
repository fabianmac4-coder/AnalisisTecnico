"""Repositorio del cache SQL de inteligencia de mercado (dbo.C080).

Cache compartido (no por usuario): guarda respuestas agregadas/publicas
(overview, sentimiento, indices) con expiracion. Lectura = fila Activo mas
reciente no expirada por (TipoDato, Clave). Escritura = inserta una fila nueva
(IDENTITY) y desactiva las anteriores de la misma (TipoDato, Clave).
"""
from __future__ import annotations

import json
from datetime import timedelta
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import MarketCache
from app.repositories.sql_utils import utcnow


class MarketCacheRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_fresh(self, tipo_dato: str, clave: str) -> dict | None:
        """Devuelve el DataJSON parseado de la fila activa NO expirada, o None."""
        now = utcnow()
        row = self.db.execute(
            select(MarketCache)
            .where(
                MarketCache.TipoDato == tipo_dato,
                MarketCache.Clave == clave,
                MarketCache.Activo == True,  # noqa: E712
                MarketCache.FechaExpiracion > now,
            )
            .order_by(MarketCache.FechaObtencion.desc())
            .limit(1)
        ).scalar_one_or_none()
        if row is None:
            return None
        try:
            value = json.loads(row.DataJSON)
            return value if isinstance(value, dict) else None
        except (TypeError, ValueError):
            return None

    def get_latest_any(self, tipo_dato: str, clave: str) -> dict | None:
        """Ultimo DataJSON disponible AUNQUE este expirado (fallback al fallar el proveedor)."""
        row = self.db.execute(
            select(MarketCache)
            .where(
                MarketCache.TipoDato == tipo_dato,
                MarketCache.Clave == clave,
                MarketCache.Activo == True,  # noqa: E712
            )
            .order_by(MarketCache.FechaObtencion.desc())
            .limit(1)
        ).scalar_one_or_none()
        if row is None:
            return None
        try:
            value = json.loads(row.DataJSON)
            return value if isinstance(value, dict) else None
        except (TypeError, ValueError):
            return None

    def store(
        self,
        tipo_dato: str,
        proveedor: str,
        clave: str,
        data: dict[str, Any],
        ttl_minutes: int,
    ) -> MarketCache:
        """Inserta una fila nueva y desactiva las anteriores de la misma clave."""
        now = utcnow()
        # Desactiva las versiones previas (mantiene la tabla limpia, conserva historia inactiva).
        self.db.execute(
            update(MarketCache)
            .where(
                MarketCache.TipoDato == tipo_dato,
                MarketCache.Clave == clave,
                MarketCache.Activo == True,  # noqa: E712
            )
            .values(Activo=False)
        )
        row = MarketCache(
            TipoDato=tipo_dato,
            Proveedor=proveedor,
            Clave=clave,
            DataJSON=json.dumps(data),
            FechaObtencion=now,
            FechaExpiracion=now + timedelta(minutes=max(1, ttl_minutes)),
            Activo=True,
        )
        self.db.add(row)
        self.db.flush()
        return row
