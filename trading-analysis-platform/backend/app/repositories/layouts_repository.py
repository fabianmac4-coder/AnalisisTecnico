"""Repositorio SQL de layouts (dbo.C030). Un default por usuario."""
from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import LayoutGrafica
from app.repositories.sql_utils import next_id, utcnow


class LayoutsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_default_by_user(self, user_id: int) -> LayoutGrafica | None:
        return self.db.execute(
            select(LayoutGrafica).where(
                LayoutGrafica.C005Id == user_id,
                LayoutGrafica.EsDefault == True,  # noqa: E712
            )
        ).scalar_one_or_none()

    def list_by_user(self, user_id: int) -> list[LayoutGrafica]:
        return list(
            self.db.execute(
                select(LayoutGrafica)
                .where(LayoutGrafica.C005Id == user_id)
                .order_by(LayoutGrafica.C030Id)
            ).scalars()
        )

    def upsert_default(self, user_id: int, configuracion: dict) -> LayoutGrafica:
        existing = self.get_default_by_user(user_id)
        if existing is not None:
            existing.ConfiguracionJSON = json.dumps(configuracion)
            existing.FechaActualizacion = utcnow()
            self.db.flush()
            return existing

        now = utcnow()
        layout = LayoutGrafica(
            C030Id=next_id(self.db, LayoutGrafica.C030Id),
            C005Id=user_id,
            NombreLayout="Default",
            EsDefault=True,
            ConfiguracionJSON=json.dumps(configuracion),
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(layout)
        self.db.flush()
        return layout
