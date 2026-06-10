"""Schemas para busqueda y resolucion de simbolos."""
from __future__ import annotations

from pydantic import BaseModel


class SymbolInfo(BaseModel):
    symbol: str
    name: str | None = None
    exchange: str | None = None
    currency: str | None = None
    type: str = "unknown"  # equity | etf | index | crypto | fx | unknown
    provider: str = "yahoo"


class SymbolSearchResponse(BaseModel):
    query: str
    results: list[SymbolInfo]
