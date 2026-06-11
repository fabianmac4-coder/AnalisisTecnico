"""Entradas simuladas / paper trading (dbo.C050). NO es trading real.

Todos los endpoints requieren usuario autenticado y se acotan por C005Id.
El rendimiento usa el precio canonico actual (yahoo) y es HIPOTETICO.
"""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Accion, OperacionSimulada, Usuario
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.operaciones_simuladas_repository import (
    OperacionesSimuladasRepository,
    calculate_performance,
)
from app.security.dependencies import get_current_active_user

logger = logging.getLogger("simulated_trades")

router = APIRouter(prefix="/simulated-trades", tags=["Simulated Trades"])


class SimulatedTradeOut(BaseModel):
    id: int
    c010Id: int
    symbol: str
    type: str
    entryPrice: float
    quantity: float | None = None
    entryDate: str
    sourceTimeframe: str | None = None
    name: str | None = None
    notes: str | None = None
    status: str
    color: str | None = None
    exitPrice: float | None = None
    exitDate: str | None = None
    exitReason: str | None = None
    currentPrice: float | None = None
    gainLossAmount: float | None = None
    gainLossPercent: float | None = None
    totalGainLossAmount: float | None = None
    daysSinceEntry: int
    visible: bool


class SimulatedTradeCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=30)
    type: str = Field(default="LONG", pattern="^(LONG|SHORT)$")
    entryPrice: float = Field(gt=0)
    quantity: float | None = Field(default=None, gt=0)
    entryDate: datetime | None = None
    sourceTimeframe: str | None = Field(default=None, max_length=30)
    name: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    color: str | None = Field(default=None, max_length=30)


class SimulatedTradeUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    quantity: float | None = Field(default=None, gt=0)
    color: str | None = Field(default=None, max_length=30)
    visible: bool | None = None


class SimulatedTradeClose(BaseModel):
    exitPrice: float = Field(gt=0)
    exitDate: datetime | None = None
    reason: str | None = Field(default=None, max_length=500)


def _current_price(symbol: str) -> float | None:
    """Precio canonico actual; None si el mercado no responde (sin romper)."""
    try:
        from app.services import yahoo_service

        return yahoo_service.get_quote(symbol).price
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sin cotizacion de %s: %s", symbol, type(exc).__name__)
        return None


def _to_out(
    op: OperacionSimulada, accion: Accion, current_price: float | None
) -> SimulatedTradeOut:
    perf = calculate_performance(op, current_price)
    return SimulatedTradeOut(
        id=op.C050Id,
        c010Id=op.C010Id,
        symbol=accion.Ticker,
        type=op.TipoOperacion,
        entryPrice=float(op.PrecioEntrada),
        quantity=float(op.Cantidad) if op.Cantidad is not None else None,
        entryDate=op.FechaEntrada.isoformat(),
        sourceTimeframe=op.TemporalidadOrigen,
        name=op.NombreOperacion,
        notes=op.Notas,
        status=op.Estado,
        color=op.Color,
        exitPrice=float(op.PrecioSalida) if op.PrecioSalida is not None else None,
        exitDate=op.FechaSalida.isoformat() if op.FechaSalida else None,
        exitReason=op.MotivoSalida,
        visible=bool(op.Visible),
        **perf,
    )


@router.get("", response_model=list[SimulatedTradeOut])
def list_simulated_trades(
    symbol: str = Query(..., min_length=1, max_length=30),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[SimulatedTradeOut]:
    accion = AccionesRepository(db).get_by_yahoo_symbol(symbol)
    if accion is None:
        return []
    ops = OperacionesSimuladasRepository(db).list_by_user_and_action(
        user.C005Id, accion.C010Id
    )
    price = _current_price(accion.YahooSymbol) if ops else None
    return [_to_out(op, accion, price) for op in ops]


@router.post("", response_model=SimulatedTradeOut, status_code=201)
def create_simulated_trade(
    payload: SimulatedTradeCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> SimulatedTradeOut:
    accion = AccionesRepository(db).get_or_create_from_yahoo_symbol(payload.symbol)
    op = OperacionesSimuladasRepository(db).create_entry(
        user_id=user.C005Id,
        c010_id=accion.C010Id,
        tipo=payload.type,
        precio_entrada=payload.entryPrice,
        fecha_entrada=payload.entryDate or datetime.utcnow(),
        cantidad=payload.quantity,
        temporalidad=payload.sourceTimeframe,
        nombre=payload.name,
        notas=payload.notes,
        color=payload.color,
    )
    db.commit()
    return _to_out(op, accion, _current_price(accion.YahooSymbol))


@router.patch("/{c050_id}", response_model=SimulatedTradeOut)
def update_simulated_trade(
    c050_id: int,
    payload: SimulatedTradeUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> SimulatedTradeOut:
    changes: dict = {}
    if payload.name is not None:
        changes["NombreOperacion"] = payload.name
    if payload.notes is not None:
        changes["Notas"] = payload.notes
    if payload.quantity is not None:
        changes["Cantidad"] = payload.quantity
    if payload.color is not None:
        changes["Color"] = payload.color
    if payload.visible is not None:
        changes["Visible"] = payload.visible

    op = OperacionesSimuladasRepository(db).update_entry(
        user.C005Id, c050_id, **changes
    )
    if op is None:
        raise HTTPException(status_code=404, detail="Entrada simulada no encontrada")
    db.commit()
    accion = AccionesRepository(db).get_by_id(op.C010Id)
    return _to_out(op, accion, _current_price(accion.YahooSymbol))


@router.post("/{c050_id}/close", response_model=SimulatedTradeOut)
def close_simulated_trade(
    c050_id: int,
    payload: SimulatedTradeClose,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> SimulatedTradeOut:
    op = OperacionesSimuladasRepository(db).close_entry(
        user.C005Id,
        c050_id,
        exit_price=payload.exitPrice,
        exit_date=payload.exitDate or datetime.utcnow(),
        reason=payload.reason,
    )
    if op is None:
        raise HTTPException(status_code=404, detail="Entrada simulada no encontrada")
    db.commit()
    accion = AccionesRepository(db).get_by_id(op.C010Id)
    # CERRADA: el rendimiento ya se calcula con PrecioSalida.
    return _to_out(op, accion, None)


@router.delete("/{c050_id}", status_code=204)
def delete_simulated_trade(
    c050_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> None:
    """Borrado suave: Activo=0 y Visible=0 (no se borra nada fisico)."""
    deleted = OperacionesSimuladasRepository(db).soft_delete_entry(user.C005Id, c050_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Entrada simulada no encontrada")
    db.commit()
