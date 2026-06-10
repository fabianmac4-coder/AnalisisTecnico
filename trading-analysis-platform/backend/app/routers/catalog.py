"""Catalogo/watchlist respaldado en SQL (dbo.C040 + dbo.C010), por usuario.

Devuelve la forma CatalogSymbol que ya consume el frontend.
DELETE = Activo=0 (nunca borrado fisico).
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Accion, CatalogoUsuarioAccion, Usuario
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.catalogo_repository import CatalogoRepository
from app.security.dependencies import get_current_active_user

router = APIRouter(prefix="/catalog", tags=["catalog"])


class CatalogSymbolOut(BaseModel):
    id: str  # str(C010Id)
    symbol: str
    name: str | None = None
    exchange: str | None = None
    currency: str | None = None
    type: str | None = None
    provider: str = "yahoo"
    pinned: bool = False
    tags: list[str] = Field(default_factory=list)
    lastViewedAt: str | None = None
    createdAt: str | None = None
    updatedAt: str | None = None


class CatalogAdd(BaseModel):
    symbol: str = Field(min_length=1)
    name: str | None = None
    exchange: str | None = None
    currency: str | None = None
    type: str | None = None
    pinned: bool = False


class CatalogUpdate(BaseModel):
    pinned: bool | None = None
    lastViewedAt: str | None = None
    tags: list[str] | None = None
    notas: str | None = None


def _to_out(entry: CatalogoUsuarioAccion, accion: Accion) -> CatalogSymbolOut:
    try:
        tags = json.loads(entry.TagsJSON) if entry.TagsJSON else []
    except (TypeError, ValueError):
        tags = []
    return CatalogSymbolOut(
        id=str(accion.C010Id),
        symbol=accion.Ticker,
        name=accion.NombreInstrumento,
        exchange=accion.Exchange,
        currency=accion.Moneda,
        type=accion.TipoInstrumento,
        provider="yahoo",
        pinned=bool(entry.Favorito),
        tags=tags if isinstance(tags, list) else [],
        lastViewedAt=entry.UltimaConsulta.isoformat() if entry.UltimaConsulta else None,
        createdAt=entry.FechaCreacion.isoformat() if entry.FechaCreacion else None,
        updatedAt=entry.FechaActualizacion.isoformat() if entry.FechaActualizacion else None,
    )


@router.get("", response_model=list[CatalogSymbolOut])
def list_catalog(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[CatalogSymbolOut]:
    rows = CatalogoRepository(db).list_by_user(user.C005Id)
    return [_to_out(entry, accion) for entry, accion in rows]


@router.post("", response_model=CatalogSymbolOut, status_code=201)
def add_to_catalog(
    payload: CatalogAdd,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> CatalogSymbolOut:
    accion = AccionesRepository(db).get_or_create_from_yahoo_symbol(
        payload.symbol,
        meta={
            "name": payload.name,
            "exchange": payload.exchange,
            "currency": payload.currency,
            "type": payload.type,
        },
    )
    entry = CatalogoRepository(db).add_or_update_action_for_user(
        user.C005Id, accion.C010Id, favorito=payload.pinned or None
    )
    db.commit()
    return _to_out(entry, accion)


@router.patch("/{c010_id}", response_model=CatalogSymbolOut)
def update_catalog_entry(
    c010_id: int,
    payload: CatalogUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> CatalogSymbolOut:
    repo = CatalogoRepository(db)
    entry = repo.get_entry(user.C005Id, c010_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Símbolo no está en el catálogo")
    if payload.pinned is not None:
        repo.update_favorite(user.C005Id, c010_id, payload.pinned)
    if payload.lastViewedAt is not None:
        repo.touch_last_viewed(user.C005Id, c010_id)
    if payload.tags is not None:
        entry.TagsJSON = json.dumps(payload.tags)
    if payload.notas is not None:
        entry.Notas = payload.notas
    db.commit()
    accion = AccionesRepository(db).get_by_id(c010_id)
    return _to_out(entry, accion)


@router.delete("/{c010_id}", status_code=204)
def remove_from_catalog(
    c010_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> None:
    CatalogoRepository(db).deactivate_from_catalog(user.C005Id, c010_id)
    db.commit()
