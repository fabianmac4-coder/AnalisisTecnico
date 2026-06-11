"""Repositorio del cache SQL de market movers (dbo.C062/C063)."""
from __future__ import annotations

import json
from datetime import timedelta

from sqlalchemy import case, delete, select
from sqlalchemy.orm import Session

from app.models import ListaMercado, ListaMercadoDetalle
from app.repositories.sql_utils import utcnow
from app.services.market_movers.market_movers_types import MarketMoverItem

LIST_TYPES = ("TRENDING", "TOP_GAINERS", "TOP_LOSERS", "MOST_ACTIVE")


class MarketMoversRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_snapshot(
        self, list_type: str, provider: str, raw_json: str | None = None
    ) -> ListaMercado:
        snapshot = ListaMercado(
            TipoLista=list_type,
            Proveedor=provider,
            FechaObtencion=utcnow(),
            RawJSON=raw_json,
            Activo=True,
        )
        self.db.add(snapshot)
        self.db.flush()
        return snapshot

    def add_snapshot_item(
        self,
        c062_id: int,
        item: MarketMoverItem,
        c010_id: int | None = None,
        ranking: int | None = None,
    ) -> ListaMercadoDetalle:
        detalle = ListaMercadoDetalle(
            C062Id=c062_id,
            C010Id=c010_id,
            Ticker=item.symbol[:30],
            YahooSymbol=item.symbol[:50],
            NombreInstrumento=(item.name or "")[:250] or None,
            Precio=item.price,
            Cambio=item.change,
            CambioPorcentaje=item.changePercent,
            Volumen=int(item.volume) if item.volume is not None else None,
            MarketCap=item.marketCap,
            Ranking=ranking,
            RawJSON=json.dumps(item.raw) if item.raw else None,
            FechaCreacion=utcnow(),
        )
        self.db.add(detalle)
        self.db.flush()
        return detalle

    def get_latest_snapshot(
        self, list_type: str, max_age_minutes: int | None = None
    ) -> ListaMercado | None:
        query = (
            select(ListaMercado)
            .where(
                ListaMercado.TipoLista == list_type,
                ListaMercado.Activo == True,  # noqa: E712
            )
            .order_by(ListaMercado.FechaObtencion.desc())
            .limit(1)
        )
        snapshot = self.db.execute(query).scalar_one_or_none()
        if snapshot is None:
            return None
        if max_age_minutes is not None:
            cutoff = utcnow() - timedelta(minutes=max_age_minutes)
            if snapshot.FechaObtencion < cutoff:
                return None
        return snapshot

    def get_snapshot_items(self, c062_id: int, limit: int = 50) -> list[ListaMercadoDetalle]:
        return list(
            self.db.execute(
                select(ListaMercadoDetalle)
                .where(ListaMercadoDetalle.C062Id == c062_id)
                # SQL Server no soporta NULLS LAST: CASE portable.
                .order_by(
                    case((ListaMercadoDetalle.Ranking.is_(None), 1), else_=0),
                    ListaMercadoDetalle.Ranking.asc(),
                )
                .limit(limit)
            ).scalars()
        )

    def get_latest_snapshot_items(
        self, list_type: str, limit: int = 50, max_age_minutes: int | None = None
    ) -> tuple[ListaMercado | None, list[ListaMercadoDetalle]]:
        snapshot = self.get_latest_snapshot(list_type, max_age_minutes)
        if snapshot is None:
            return None, []
        return snapshot, self.get_snapshot_items(snapshot.C062Id, limit)

    def cleanup_old_snapshots(self, days: int = 7) -> int:
        cutoff = utcnow() - timedelta(days=days)
        old_ids = [
            row
            for row in self.db.execute(
                select(ListaMercado.C062Id).where(ListaMercado.FechaObtencion < cutoff)
            ).scalars()
        ]
        if not old_ids:
            return 0
        self.db.execute(
            delete(ListaMercadoDetalle).where(ListaMercadoDetalle.C062Id.in_(old_ids))
        )
        self.db.execute(delete(ListaMercado).where(ListaMercado.C062Id.in_(old_ids)))
        self.db.flush()
        return len(old_ids)
