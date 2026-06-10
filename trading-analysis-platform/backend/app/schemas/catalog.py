"""Schemas del catalogo de simbolos (watchlist)."""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CatalogSymbol(BaseModel):
    id: str
    symbol: str
    name: str | None = None
    exchange: str | None = None
    currency: str | None = None
    type: str = "unknown"
    provider: str = "yahoo"
    pinned: bool = False
    tags: list[str] = Field(default_factory=list)
    lastViewedAt: str = Field(default_factory=_now_iso)
    createdAt: str = Field(default_factory=_now_iso)
    updatedAt: str = Field(default_factory=_now_iso)


class CatalogSymbolCreate(BaseModel):
    symbol: str
    name: str | None = None
    exchange: str | None = None
    currency: str | None = None
    type: str = "unknown"
    pinned: bool = False
    tags: list[str] = Field(default_factory=list)


class CatalogSymbolUpdate(BaseModel):
    name: str | None = None
    pinned: bool | None = None
    tags: list[str] | None = None
    lastViewedAt: str | None = None
