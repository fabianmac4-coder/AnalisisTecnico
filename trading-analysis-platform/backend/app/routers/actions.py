"""Instrumentos (dbo.C010): busqueda local y sincronizacion desde Yahoo."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Accion, Usuario
from app.repositories.acciones_repository import AccionesRepository
from app.security.dependencies import get_current_active_user
from app.services import yahoo_service

router = APIRouter(prefix="/actions", tags=["actions"])


class ActionOut(BaseModel):
    c010Id: int
    ticker: str
    yahooSymbol: str
    nombre: str | None = None
    tipo: str
    exchange: str | None = None
    moneda: str | None = None
    activo: bool


class SyncRequest(BaseModel):
    symbol: str = Field(min_length=1)


def _to_out(a: Accion) -> ActionOut:
    return ActionOut(
        c010Id=a.C010Id,
        ticker=a.Ticker,
        yahooSymbol=a.YahooSymbol,
        nombre=a.NombreInstrumento,
        tipo=a.TipoInstrumento,
        exchange=a.Exchange,
        moneda=a.Moneda,
        activo=bool(a.Activo),
    )


@router.get("/search", response_model=list[ActionOut])
def search_actions(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> list[ActionOut]:
    return [_to_out(a) for a in AccionesRepository(db).search(q)]


@router.get("/{ticker}", response_model=ActionOut)
def get_action(
    ticker: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> ActionOut:
    accion = AccionesRepository(db).get_by_ticker(ticker)
    if accion is None:
        raise HTTPException(status_code=404, detail="Instrumento no encontrado")
    return _to_out(accion)


@router.post("/sync-from-yahoo", response_model=ActionOut)
def sync_from_yahoo(
    payload: SyncRequest,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_active_user),
) -> ActionOut:
    """Valida el simbolo en Yahoo y crea/actualiza su metadata en C010."""
    results = yahoo_service.search_symbols(payload.symbol)
    if not results:
        raise HTTPException(status_code=404, detail="Símbolo no reconocido por Yahoo")
    info = results[0]
    accion = AccionesRepository(db).upsert_action(
        info.symbol,
        meta={
            "name": info.name,
            "exchange": info.exchange,
            "currency": info.currency,
            "type": info.type,
        },
    )
    db.commit()
    return _to_out(accion)
