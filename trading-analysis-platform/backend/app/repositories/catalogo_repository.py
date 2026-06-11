"""Repositorio SQL del catalogo/watchlist por usuario (dbo.C040).

Un registro por (C005Id, C010Id) — indice UQ_C040_UsuarioAccion.
"""
from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Accion, CatalogoUsuarioAccion
from app.repositories.sql_utils import next_id, utcnow


class CatalogoRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user(self, user_id: int) -> list[tuple[CatalogoUsuarioAccion, Accion]]:
        # Favoritos primero, luego por ultima consulta y ticker.
        rows = self.db.execute(
            select(CatalogoUsuarioAccion, Accion)
            .join(Accion, CatalogoUsuarioAccion.C010Id == Accion.C010Id)
            .where(
                CatalogoUsuarioAccion.C005Id == user_id,
                CatalogoUsuarioAccion.Activo == True,  # noqa: E712
            )
            .order_by(
                CatalogoUsuarioAccion.Favorito.desc(),
                CatalogoUsuarioAccion.UltimaConsulta.desc(),
                Accion.Ticker.asc(),
            )
        ).all()
        return [(r[0], r[1]) for r in rows]

    def get_entry(self, user_id: int, c010_id: int) -> CatalogoUsuarioAccion | None:
        return self.db.execute(
            select(CatalogoUsuarioAccion).where(
                CatalogoUsuarioAccion.C005Id == user_id,
                CatalogoUsuarioAccion.C010Id == c010_id,
            )
        ).scalar_one_or_none()

    def add_or_update_action_for_user(
        self, user_id: int, c010_id: int, favorito: bool | None = None
    ) -> CatalogoUsuarioAccion:
        """Agrega al catalogo o reactiva/actualiza la entrada existente."""
        entry = self.get_entry(user_id, c010_id)
        now = utcnow()
        if entry is not None:
            entry.Activo = True
            entry.UltimaConsulta = now
            if favorito is not None:
                entry.Favorito = favorito
            entry.FechaActualizacion = now
            self.db.flush()
            return entry

        entry = CatalogoUsuarioAccion(
            C040Id=next_id(self.db, CatalogoUsuarioAccion.C040Id),
            C005Id=user_id,
            C010Id=c010_id,
            Favorito=bool(favorito),
            TagsJSON=json.dumps([]),
            UltimaConsulta=now,
            Activo=True,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(entry)
        self.db.flush()
        return entry

    def update_favorite(
        self, user_id: int, c010_id: int, favorito: bool
    ) -> CatalogoUsuarioAccion | None:
        entry = self.get_entry(user_id, c010_id)
        if entry is None:
            return None
        entry.Favorito = favorito
        entry.FechaActualizacion = utcnow()
        self.db.flush()
        return entry

    def touch_last_viewed(self, user_id: int, c010_id: int) -> None:
        entry = self.get_entry(user_id, c010_id)
        if entry is not None:
            entry.UltimaConsulta = utcnow()
            self.db.flush()

    def deactivate_from_catalog(self, user_id: int, c010_id: int) -> bool:
        entry = self.get_entry(user_id, c010_id)
        if entry is None:
            return False
        entry.Activo = False
        entry.FechaActualizacion = utcnow()
        self.db.flush()
        return True
