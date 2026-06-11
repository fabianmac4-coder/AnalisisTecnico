"""Tipos comunes de market movers."""
from __future__ import annotations

from dataclasses import dataclass

LIST_TRENDING = "TRENDING"
LIST_TOP_GAINERS = "TOP_GAINERS"
LIST_TOP_LOSERS = "TOP_LOSERS"
LIST_MOST_ACTIVE = "MOST_ACTIVE"

ALL_LIST_TYPES = (LIST_TRENDING, LIST_TOP_GAINERS, LIST_TOP_LOSERS, LIST_MOST_ACTIVE)


@dataclass
class MarketMoverItem:
    symbol: str
    source: str
    name: str | None = None
    price: float | None = None
    change: float | None = None
    changePercent: float | None = None
    volume: float | None = None
    marketCap: float | None = None
    raw: dict | None = None
