"""Entradas simuladas / paper trading (dbo.C050). NO es trading real.

Todos los endpoints requieren usuario autenticado y se acotan por C005Id.
El rendimiento usa el precio canonico actual (yahoo) y es HIPOTETICO.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Accion, OperacionSimulada, Usuario
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.layouts_repository import LayoutsRepository
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
    c030Id: int | None = None
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


class SimulatedTradeDetail(SimulatedTradeOut):
    """Detalle con el snapshot de análisis (MetadataJSON / AnalisisJSON)."""

    metadata: dict | None = None
    analysisSnapshot: dict | None = None


# Campos de tesis que viven dentro de AnalisisJSON.simulatedEntryThesis.
class EntryThesis(BaseModel):
    scenario: str | None = None
    bullishCase: str | None = None
    bearishCase: str | None = None
    invalidation: str | None = None
    targetArea: str | None = None


class SimulatedTradeCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=30)
    c030Id: int | None = None
    type: str = Field(default="LONG", pattern="^(LONG|SHORT)$")
    entryPrice: float = Field(gt=0)
    quantity: float | None = Field(default=None, gt=0)
    entryDate: datetime | None = None
    sourceTimeframe: str | None = Field(default=None, max_length=30)
    name: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    color: str | None = Field(default=None, max_length=30)
    # Tesis de la entrada (se guarda en AnalisisJSON.simulatedEntryThesis).
    entryThesis: str | None = None
    bullishScenario: str | None = None
    bearishScenario: str | None = None
    invalidationLevel: str | float | None = None
    targetArea: str | float | None = None
    # Contexto crudo: metadata del clic/vela/gráfica y snapshot de análisis.
    metadata: dict | None = None
    analysisSnapshot: dict | None = None


class SimulatedTradeUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    quantity: float | None = Field(default=None, gt=0)
    color: str | None = Field(default=None, max_length=30)
    visible: bool | None = None
    # Edición de la tesis (actualiza AnalisisJSON.simulatedEntryThesis).
    thesis: EntryThesis | None = None


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
        c030Id=op.C030Id,
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


def _safe_json(value: str | None) -> dict | None:
    if not value:
        return None
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else None
    except (TypeError, ValueError):
        return None


def _to_detail(
    op: OperacionSimulada, accion: Accion, current_price: float | None
) -> SimulatedTradeDetail:
    base = _to_out(op, accion, current_price)
    return SimulatedTradeDetail(
        **base.model_dump(),
        metadata=_safe_json(op.MetadataJSON),
        analysisSnapshot=_safe_json(op.AnalisisJSON),
    )


@router.get("", response_model=list[SimulatedTradeOut])
def list_simulated_trades(
    symbol: str = Query(..., min_length=1, max_length=30),
    c030Id: int | None = Query(None, description="Workspace activo (C030Id)"),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[SimulatedTradeOut]:
    accion = AccionesRepository(db).get_by_yahoo_symbol(symbol)
    if accion is None:
        return []
    repo = OperacionesSimuladasRepository(db)
    if c030Id is None:
        ops = repo.list_by_user_and_action(user.C005Id, accion.C010Id)
    else:
        ops = repo.list_by_user_action_workspace(user.C005Id, accion.C010Id, c030Id)
    price = _current_price(accion.YahooSymbol) if ops else None
    return [_to_out(op, accion, price) for op in ops]


@router.get("/{c050_id}", response_model=SimulatedTradeDetail)
def get_simulated_trade_detail(
    c050_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> SimulatedTradeDetail:
    op = OperacionesSimuladasRepository(db).get_by_id_for_user(user.C005Id, c050_id)
    if op is None:
        raise HTTPException(status_code=404, detail="Entrada simulada no encontrada")
    accion = AccionesRepository(db).get_by_id(op.C010Id)
    return _to_detail(op, accion, _current_price(accion.YahooSymbol))


def _build_analysis_json(payload: SimulatedTradeCreate) -> str | None:
    """Combina el snapshot recibido + la tesis discreta en un solo AnalisisJSON."""
    snapshot = dict(payload.analysisSnapshot) if payload.analysisSnapshot else {}
    thesis = {
        "scenario": payload.entryThesis,
        "bullishCase": payload.bullishScenario,
        "bearishCase": payload.bearishScenario,
        "invalidation": payload.invalidationLevel,
        "targetArea": payload.targetArea,
    }
    thesis = {k: v for k, v in thesis.items() if v is not None}
    if thesis:
        snapshot.setdefault("simulatedEntryThesis", {}).update(thesis)
    return json.dumps(snapshot) if snapshot else None


@router.post("", response_model=SimulatedTradeOut, status_code=201)
def create_simulated_trade(
    payload: SimulatedTradeCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> SimulatedTradeOut:
    accion = AccionesRepository(db).get_or_create_from_yahoo_symbol(payload.symbol)
    # Si se manda c030Id, debe ser un workspace del usuario y de esta accion.
    if payload.c030Id is not None:
        ws = LayoutsRepository(db).get_workspace(user.C005Id, payload.c030Id)
        if ws is None or ws.C010Id != accion.C010Id:
            raise HTTPException(
                status_code=400, detail="Workspace inválido para el símbolo."
            )
    op = OperacionesSimuladasRepository(db).create_entry(
        user_id=user.C005Id,
        c010_id=accion.C010Id,
        c030_id=payload.c030Id,
        tipo=payload.type,
        precio_entrada=payload.entryPrice,
        fecha_entrada=payload.entryDate or datetime.utcnow(),
        cantidad=payload.quantity,
        temporalidad=payload.sourceTimeframe,
        nombre=payload.name,
        notas=payload.notes,
        color=payload.color,
        metadata_json=json.dumps(payload.metadata) if payload.metadata else None,
        analisis_json=_build_analysis_json(payload),
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
    repo = OperacionesSimuladasRepository(db)
    op = repo.get_by_id_for_user(user.C005Id, c050_id)
    if op is None:
        raise HTTPException(status_code=404, detail="Entrada simulada no encontrada")

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
    # La tesis edita SOLO AnalisisJSON.simulatedEntryThesis; no pisa el snapshot.
    if payload.thesis is not None:
        snapshot = _safe_json(op.AnalisisJSON) or {}
        thesis = {k: v for k, v in payload.thesis.model_dump().items() if v is not None}
        merged = {**snapshot.get("simulatedEntryThesis", {}), **thesis}
        snapshot["simulatedEntryThesis"] = merged
        changes["AnalisisJSON"] = json.dumps(snapshot)

    repo.update_entry(user.C005Id, c050_id, **changes)
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
