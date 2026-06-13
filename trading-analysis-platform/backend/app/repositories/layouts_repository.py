"""Repositorio SQL de layouts/workspaces (dbo.C030).

Dos usos sobre la misma tabla:
- Layout GLOBAL heredado (C010Id IS NULL): un default por usuario; guarda
  preferencias de UI (ej. chartTypeByPreset). Lo consume `/layouts/default`.
- WORKSPACES por accion (C010Id fijo): varias filas por usuario+accion, cada una
  con su configuracion de seis slots. Lo consumen los endpoints `/layouts/stock/*`.

Todo se acota por C005Id: un usuario nunca ve filas de otro.
"""
from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import LayoutGrafica
from app.repositories.sql_utils import next_id, utcnow


class LayoutsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------ global
    def get_default_by_user(self, user_id: int) -> LayoutGrafica | None:
        """Layout global default (C010Id IS NULL) del usuario."""
        return self.db.execute(
            select(LayoutGrafica).where(
                LayoutGrafica.C005Id == user_id,
                LayoutGrafica.C010Id.is_(None),
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
            C010Id=None,
            NombreLayout="Default",
            EsDefault=True,
            ConfiguracionJSON=json.dumps(configuracion),
            Activo=True,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(layout)
        self.db.flush()
        return layout

    # --------------------------------------------------------------- workspaces
    def list_workspaces(self, user_id: int, c010_id: int) -> list[LayoutGrafica]:
        """Workspaces activos del usuario para una accion (default primero)."""
        return list(
            self.db.execute(
                select(LayoutGrafica)
                .where(
                    LayoutGrafica.C005Id == user_id,
                    LayoutGrafica.C010Id == c010_id,
                    LayoutGrafica.Activo == True,  # noqa: E712
                )
                .order_by(
                    LayoutGrafica.EsDefault.desc(),
                    LayoutGrafica.C030Id,
                )
            ).scalars()
        )

    def get_workspace(self, user_id: int, c030_id: int) -> LayoutGrafica | None:
        """Workspace activo propiedad del usuario (scoping por C005Id)."""
        return self.db.execute(
            select(LayoutGrafica).where(
                LayoutGrafica.C030Id == c030_id,
                LayoutGrafica.C005Id == user_id,
                LayoutGrafica.Activo == True,  # noqa: E712
            )
        ).scalar_one_or_none()

    def count_workspaces(self, user_id: int, c010_id: int) -> int:
        return len(self.list_workspaces(user_id, c010_id))

    def create_workspace(
        self,
        user_id: int,
        c010_id: int,
        name: str,
        configuracion: dict,
        es_default: bool,
    ) -> LayoutGrafica:
        if es_default:
            self._unset_defaults(user_id, c010_id)
        now = utcnow()
        ws = LayoutGrafica(
            C030Id=next_id(self.db, LayoutGrafica.C030Id),
            C005Id=user_id,
            C010Id=c010_id,
            NombreLayout=name,
            EsDefault=es_default,
            ConfiguracionJSON=json.dumps(configuracion),
            Activo=True,
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        self.db.add(ws)
        self.db.flush()
        return ws

    def update_workspace(
        self,
        ws: LayoutGrafica,
        *,
        name: str | None = None,
        configuracion: dict | None = None,
    ) -> LayoutGrafica:
        if name is not None:
            ws.NombreLayout = name
        if configuracion is not None:
            ws.ConfiguracionJSON = json.dumps(configuracion)
        ws.FechaActualizacion = utcnow()
        self.db.flush()
        return ws

    def set_default(self, user_id: int, ws: LayoutGrafica) -> LayoutGrafica:
        """Marca este workspace como default y desmarca los demas de la accion."""
        self._unset_defaults(user_id, ws.C010Id, exclude_id=ws.C030Id)
        ws.EsDefault = True
        ws.FechaActualizacion = utcnow()
        self.db.flush()
        return ws

    def soft_delete(self, ws: LayoutGrafica) -> None:
        """Borrado suave del workspace (Activo=0). No toca datos relacionados."""
        ws.Activo = False
        ws.EsDefault = False
        ws.FechaActualizacion = utcnow()
        self.db.flush()

    def ensure_a_default(self, user_id: int, c010_id: int) -> None:
        """Garantiza que exista UN default activo para usuario+accion."""
        active = self.list_workspaces(user_id, c010_id)
        if not active:
            return
        if any(w.EsDefault for w in active):
            return
        active[0].EsDefault = True
        active[0].FechaActualizacion = utcnow()
        self.db.flush()

    def _unset_defaults(
        self, user_id: int, c010_id: int | None, exclude_id: int | None = None
    ) -> None:
        for w in self.list_workspaces(user_id, c010_id) if c010_id is not None else []:
            if exclude_id is not None and w.C030Id == exclude_id:
                continue
            if w.EsDefault:
                w.EsDefault = False
                w.FechaActualizacion = utcnow()
        self.db.flush()
