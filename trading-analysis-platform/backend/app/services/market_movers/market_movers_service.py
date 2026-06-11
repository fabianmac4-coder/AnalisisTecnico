"""Orquestador de market movers: provider -> snapshots SQL (C062/C063) -> API.

Mismas reglas que noticias: TTL corto, forceRefresh ignora el TTL, y si el
provider falla se devuelve el ultimo snapshot disponible (con warning).
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.config import env_settings
from app.models import ListaMercado, ListaMercadoDetalle
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.market_movers_repository import MarketMoversRepository
from app.repositories.sql_utils import utcnow
from app.services.market_movers.market_movers_types import ALL_LIST_TYPES
from app.services.market_movers.yahoo_market_movers_provider import (
    YahooMarketMoversProvider,
)

logger = logging.getLogger("movers_orchestrator")

_provider = YahooMarketMoversProvider()


def _item_to_dict(row: ListaMercadoDetalle, source: str) -> dict:
    return {
        "symbol": row.Ticker,
        "name": row.NombreInstrumento,
        "price": float(row.Precio) if row.Precio is not None else None,
        "change": float(row.Cambio) if row.Cambio is not None else None,
        "changePercent": float(row.CambioPorcentaje)
        if row.CambioPorcentaje is not None
        else None,
        "volume": float(row.Volumen) if row.Volumen is not None else None,
        "marketCap": float(row.MarketCap) if row.MarketCap is not None else None,
        "ranking": row.Ranking,
        "source": source,
    }


def _snapshot_payload(
    snapshot: ListaMercado | None, items: list[ListaMercadoDetalle]
) -> dict:
    return {
        "lastUpdated": snapshot.FechaObtencion.isoformat() if snapshot else None,
        "items": [
            _item_to_dict(i, snapshot.Proveedor if snapshot else "YAHOO") for i in items
        ],
    }


def get_list(
    db: Session, list_type: str, limit: int = 25, force_refresh: bool = False
) -> tuple[dict, list[str]]:
    """(payload, warnings) de UNA lista, refrescando si el TTL vencio."""
    repo = MarketMoversRepository(db)
    ttl = env_settings.MARKET_MOVERS_TTL_MINUTES
    warnings: list[str] = []

    snapshot = repo.get_latest_snapshot(list_type)
    is_fresh = (
        snapshot is not None
        and (utcnow() - snapshot.FechaObtencion).total_seconds() < ttl * 60
    )

    if force_refresh or not is_fresh:
        try:
            items = _provider.get_list(list_type, limit=limit)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Provider movers fallo (%s): %s", list_type, type(exc).__name__)
            items = []
        if items:
            acciones = AccionesRepository(db)
            new_snapshot = repo.create_snapshot(list_type, _provider.name)
            for rank, item in enumerate(items, start=1):
                accion = acciones.get_by_yahoo_symbol(item.symbol)
                repo.add_snapshot_item(
                    new_snapshot.C062Id,
                    item,
                    c010_id=accion.C010Id if accion else None,
                    ranking=rank,
                )
            db.commit()
            snapshot = new_snapshot
        else:
            warnings.append(
                f"Lista {list_type} temporalmente no disponible; se muestra el cache"
            )

    if snapshot is None:
        return {"lastUpdated": None, "items": []}, warnings
    items_rows = repo.get_snapshot_items(snapshot.C062Id, limit)
    return _snapshot_payload(snapshot, items_rows), warnings


def get_all_lists(db: Session, limit: int = 25, force_refresh: bool = False) -> dict:
    out: dict = {"warnings": []}
    key_by_type = {
        "TRENDING": "trending",
        "TOP_GAINERS": "topGainers",
        "TOP_LOSERS": "topLosers",
        "MOST_ACTIVE": "mostActive",
    }
    for list_type in ALL_LIST_TYPES:
        payload, warnings = get_list(db, list_type, limit, force_refresh)
        out[key_by_type[list_type]] = payload
        out["warnings"].extend(warnings)
    return out
