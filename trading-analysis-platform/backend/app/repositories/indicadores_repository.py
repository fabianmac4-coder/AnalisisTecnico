"""Repositorio SQL de configuraciones de indicadores (dbo.C020).

C010Id NULL => configuracion GLOBAL del usuario (la que usa el dashboard).
Acotado SIEMPRE por C005Id.
"""
from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import IndicadorConfiguracion
from app.repositories.sql_utils import next_id, utcnow


class IndicadoresRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user_and_action_or_global(
        self, user_id: int, c010_id: int | None = None
    ) -> list[IndicadorConfiguracion]:
        stmt = select(IndicadorConfiguracion).where(
            IndicadorConfiguracion.C005Id == user_id
        )
        if c010_id is None:
            stmt = stmt.where(IndicadorConfiguracion.C010Id.is_(None))
        else:
            stmt = stmt.where(IndicadorConfiguracion.C010Id == c010_id)
        return list(self.db.execute(stmt.order_by(IndicadorConfiguracion.C020Id)).scalars())

    def upsert(
        self,
        user_id: int,
        nombre: str,
        tipo: str,
        visible: bool,
        aplicar_todas: bool,
        params: dict,
        estilo: dict | None,
        c010_id: int | None = None,
    ) -> IndicadorConfiguracion:
        existing = self.db.execute(
            select(IndicadorConfiguracion).where(
                IndicadorConfiguracion.C005Id == user_id,
                IndicadorConfiguracion.NombreIndicador == nombre,
                (
                    IndicadorConfiguracion.C010Id.is_(None)
                    if c010_id is None
                    else IndicadorConfiguracion.C010Id == c010_id
                ),
            )
        ).scalar_one_or_none()

        if existing is not None:
            existing.TipoIndicador = tipo
            existing.Visible = visible
            existing.AplicarTodasTemporalidades = aplicar_todas
            existing.ParametrosJSON = json.dumps(params)
            existing.EstiloJSON = json.dumps(estilo) if estilo is not None else None
            existing.FechaActualizacion = utcnow()
            self.db.flush()
            return existing

        now = utcnow()
        config = IndicadorConfiguracion(
            C020Id=next_id(self.db, IndicadorConfiguracion.C020Id),
            C005Id=user_id,
            C010Id=c010_id,
            TipoIndicador=tipo,
            NombreIndicador=nombre,
            Visible=visible,
            AplicarTodasTemporalidades=aplicar_todas,
            ParametrosJSON=json.dumps(params),
            EstiloJSON=json.dumps(estilo) if estilo is not None else None,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(config)
        self.db.flush()
        return config

    def delete(self, user_id: int, c020_id: int) -> bool:
        config = self.db.get(IndicadorConfiguracion, c020_id)
        if config is None or config.C005Id != user_id:
            return False
        self.db.delete(config)
        self.db.flush()
        return True
