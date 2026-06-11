"""Interfaz comun de proveedores de market movers (best-effort)."""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.services.market_movers.market_movers_types import MarketMoverItem


class MarketMoversProviderBase(ABC):
    name: str = "BASE"

    @abstractmethod
    def get_list(self, list_type: str, limit: int = 25) -> list[MarketMoverItem]:
        """Items de la lista (TRENDING/TOP_GAINERS/...). [] si falla."""
