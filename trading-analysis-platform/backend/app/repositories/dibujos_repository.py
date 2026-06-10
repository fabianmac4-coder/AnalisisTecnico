"""Repositorio SQL de dibujos (dbo.C0101). SIEMPRE acotado por C005Id."""
from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AnalisisDibujo
from app.repositories.sql_utils import next_id, utcnow


class DibujosRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user_and_action(self, user_id: int, c010_id: int) -> list[AnalisisDibujo]:
        return list(
            self.db.execute(
                select(AnalisisDibujo)
                .where(
                    AnalisisDibujo.C005Id == user_id,
                    AnalisisDibujo.C010Id == c010_id,
                    AnalisisDibujo.Eliminado == False,  # noqa: E712
                )
                .order_by(AnalisisDibujo.C0101Id)
            ).scalars()
        )

    def get_owned(self, user_id: int, dibujo_id: int) -> AnalisisDibujo | None:
        """Solo devuelve el dibujo si pertenece al usuario (aislamiento)."""
        dibujo = self.db.get(AnalisisDibujo, dibujo_id)
        if dibujo is None or dibujo.C005Id != user_id or dibujo.Eliminado:
            return None
        return dibujo

    def create(
        self,
        user_id: int,
        c010_id: int,
        tipo: str,
        temporalidad_origen: str,
        puntos: list[dict],
        estilo: dict,
        visible: bool = True,
        bloqueado: bool = False,
        mostrar_todas: bool = True,
        temporalidades_visibles: list[str] | None = None,
        version: int = 3,
    ) -> AnalisisDibujo:
        now = utcnow()
        dibujo = AnalisisDibujo(
            C0101Id=next_id(self.db, AnalisisDibujo.C0101Id),
            C005Id=user_id,
            C010Id=c010_id,
            TipoDibujo=tipo,
            TemporalidadOrigen=temporalidad_origen,
            PuntosJSON=json.dumps(puntos),
            EstiloJSON=json.dumps(estilo),
            Visible=visible,
            Bloqueado=bloqueado,
            MostrarEnTodasTemporalidades=mostrar_todas,
            TemporalidadesVisiblesJSON=(
                json.dumps(temporalidades_visibles)
                if temporalidades_visibles is not None
                else None
            ),
            Version=version,
            FechaCreacion=now,
            FechaActualizacion=now,
            Eliminado=False,
        )
        self.db.add(dibujo)
        self.db.flush()
        return dibujo

    def update(self, dibujo: AnalisisDibujo, **changes) -> AnalisisDibujo:
        for key, value in changes.items():
            setattr(dibujo, key, value)
        dibujo.FechaActualizacion = utcnow()
        self.db.flush()
        return dibujo

    def soft_delete(self, dibujo: AnalisisDibujo) -> None:
        dibujo.Eliminado = True
        dibujo.Visible = False
        dibujo.FechaActualizacion = utcnow()
        self.db.flush()

    def delete_by_source_timeframe(
        self, user_id: int, c010_id: int, temporalidad: str
    ) -> int:
        """Soft-delete de todos los dibujos del usuario+accion+temporalidad."""
        dibujos = [
            d
            for d in self.list_by_user_and_action(user_id, c010_id)
            if d.TemporalidadOrigen == temporalidad
        ]
        for d in dibujos:
            self.soft_delete(d)
        return len(dibujos)

    def update_visibility(
        self, user_id: int, dibujo_id: int, visible: bool
    ) -> AnalisisDibujo | None:
        dibujo = self.get_owned(user_id, dibujo_id)
        if dibujo is None:
            return None
        return self.update(dibujo, Visible=visible)
