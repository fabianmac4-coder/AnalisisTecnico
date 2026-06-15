"""Repositorio SQL de configuraciones de scorecard (dbo.C081).

SIEMPRE acotado por C005Id (un usuario no ve/edita configs de otro). C081 usa
IDENTITY: el id lo asigna la base, no `next_id`.
"""
from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ConfiguracionScorecard
from app.repositories.sql_utils import utcnow
from app.services.scorecard_config import DEFAULT_SCORECARD_CONFIG


class ScorecardConfigRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_active(self, user_id: int) -> list[ConfiguracionScorecard]:
        return list(
            self.db.execute(
                select(ConfiguracionScorecard)
                .where(
                    ConfiguracionScorecard.C005Id == user_id,
                    ConfiguracionScorecard.Activo == True,  # noqa: E712
                )
                .order_by(
                    ConfiguracionScorecard.EsDefault.desc(),
                    ConfiguracionScorecard.C081Id,
                )
            ).scalars()
        )

    def get_owned(self, user_id: int, c081_id: int) -> ConfiguracionScorecard | None:
        cfg = self.db.get(ConfiguracionScorecard, c081_id)
        if cfg is None or cfg.C005Id != user_id or not cfg.Activo:
            return None
        return cfg

    def get_default(self, user_id: int) -> ConfiguracionScorecard | None:
        return self.db.execute(
            select(ConfiguracionScorecard).where(
                ConfiguracionScorecard.C005Id == user_id,
                ConfiguracionScorecard.Activo == True,  # noqa: E712
                ConfiguracionScorecard.EsDefault == True,  # noqa: E712
            )
        ).scalar_one_or_none()

    def get_or_create_default(self, user_id: int) -> ConfiguracionScorecard:
        """Default del usuario; lo crea (con la config base) si no existe."""
        existing = self.get_default(user_id)
        if existing is not None:
            return existing
        # Si tiene configs activas pero ninguna default, marca la primera.
        active = self.list_active(user_id)
        if active:
            active[0].EsDefault = True
            active[0].FechaActualizacion = utcnow()
            self.db.flush()
            return active[0]
        return self.create(user_id, "Default", DEFAULT_SCORECARD_CONFIG, es_default=True)

    def count_active(self, user_id: int) -> int:
        return len(self.list_active(user_id))

    def create(
        self, user_id: int, name: str, config: dict, es_default: bool
    ) -> ConfiguracionScorecard:
        if es_default:
            self._unset_defaults(user_id)
        now = utcnow()
        row = ConfiguracionScorecard(
            C005Id=user_id,
            NombreConfiguracion=name,
            EsDefault=es_default,
            ConfiguracionJSON=json.dumps(config),
            Activo=True,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(
        self,
        row: ConfiguracionScorecard,
        *,
        name: str | None = None,
        config: dict | None = None,
    ) -> ConfiguracionScorecard:
        if name is not None:
            row.NombreConfiguracion = name
        if config is not None:
            row.ConfiguracionJSON = json.dumps(config)
        row.FechaActualizacion = utcnow()
        self.db.flush()
        return row

    def set_default(
        self, user_id: int, row: ConfiguracionScorecard
    ) -> ConfiguracionScorecard:
        self._unset_defaults(user_id, exclude_id=row.C081Id)
        row.EsDefault = True
        row.FechaActualizacion = utcnow()
        self.db.flush()
        return row

    def soft_delete(self, row: ConfiguracionScorecard) -> None:
        row.Activo = False
        row.EsDefault = False
        row.FechaActualizacion = utcnow()
        self.db.flush()

    def ensure_a_default(self, user_id: int) -> None:
        active = self.list_active(user_id)
        if active and not any(c.EsDefault for c in active):
            active[0].EsDefault = True
            active[0].FechaActualizacion = utcnow()
            self.db.flush()

    def _unset_defaults(self, user_id: int, exclude_id: int | None = None) -> None:
        for c in self.list_active(user_id):
            if exclude_id is not None and c.C081Id == exclude_id:
                continue
            if c.EsDefault:
                c.EsDefault = False
                c.FechaActualizacion = utcnow()
        self.db.flush()
