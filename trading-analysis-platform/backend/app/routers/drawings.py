"""Dibujos respaldados en SQL (dbo.C0101), acotados al usuario autenticado.

El frontend manda/recibe su forma de Drawing (symbol, points en ms, style...);
aqui se traduce a filas: symbol -> C010Id, listas/dicts -> columnas JSON.
DELETE = soft delete (Eliminado=1, Visible=0).
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnalisisDibujo, Usuario
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.dibujos_repository import DibujosRepository
from app.schemas.drawings import DrawingIn, DrawingOut, DrawingPoint, DrawingStyle
from app.security.dependencies import get_current_active_user

router = APIRouter(prefix="/drawings", tags=["drawings"])


def _safe_json(value: str | None, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _to_out(dibujo: AnalisisDibujo, ticker: str) -> DrawingOut:
    return DrawingOut(
        id=str(dibujo.C0101Id),
        symbol=ticker,
        sourceTimeframe=dibujo.TemporalidadOrigen,
        type=dibujo.TipoDibujo,
        points=[DrawingPoint(**p) for p in _safe_json(dibujo.PuntosJSON, [])],
        style=DrawingStyle(**_safe_json(dibujo.EstiloJSON, {})),
        visible=bool(dibujo.Visible),
        locked=bool(dibujo.Bloqueado),
        showOnAllTimeframes=bool(dibujo.MostrarEnTodasTemporalidades),
        showOnTimeframes=_safe_json(dibujo.TemporalidadesVisiblesJSON, None),
        createdAt=dibujo.FechaCreacion.isoformat(),
        updatedAt=dibujo.FechaActualizacion.isoformat(),
        version=dibujo.Version,
    )


@router.get("", response_model=list[DrawingOut])
def list_drawings(
    symbol: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[DrawingOut]:
    accion = AccionesRepository(db).get_by_yahoo_symbol(symbol)
    if accion is None:
        return []  # sin instrumento registrado: no hay dibujos
    dibujos = DibujosRepository(db).list_by_user_and_action(user.C005Id, accion.C010Id)
    return [_to_out(d, accion.Ticker) for d in dibujos]


@router.post("", response_model=DrawingOut, status_code=201)
def create_drawing(
    payload: DrawingIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> DrawingOut:
    accion = AccionesRepository(db).get_or_create_from_yahoo_symbol(payload.symbol)
    dibujo = DibujosRepository(db).create(
        user_id=user.C005Id,
        c010_id=accion.C010Id,
        tipo=payload.type,
        temporalidad_origen=payload.sourceTimeframe,
        puntos=[p.model_dump() for p in payload.points],
        estilo=payload.style.model_dump(exclude_none=True),
        visible=payload.visible,
        bloqueado=payload.locked,
        mostrar_todas=payload.showOnAllTimeframes,
        temporalidades_visibles=payload.showOnTimeframes,
        version=payload.version,
    )
    db.commit()
    return _to_out(dibujo, accion.Ticker)


@router.patch("/{drawing_id}", response_model=DrawingOut)
def update_drawing(
    drawing_id: int,
    payload: DrawingIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> DrawingOut:
    repo = DibujosRepository(db)
    dibujo = repo.get_owned(user.C005Id, drawing_id)
    if dibujo is None:
        raise HTTPException(status_code=404, detail="Dibujo no encontrado")
    repo.update(
        dibujo,
        TipoDibujo=payload.type,
        TemporalidadOrigen=payload.sourceTimeframe,
        PuntosJSON=json.dumps([p.model_dump() for p in payload.points]),
        EstiloJSON=json.dumps(payload.style.model_dump(exclude_none=True)),
        Visible=payload.visible,
        Bloqueado=payload.locked,
        MostrarEnTodasTemporalidades=payload.showOnAllTimeframes,
        TemporalidadesVisiblesJSON=(
            json.dumps(payload.showOnTimeframes)
            if payload.showOnTimeframes is not None
            else None
        ),
        Version=payload.version,
    )
    db.commit()
    accion = AccionesRepository(db).get_by_id(dibujo.C010Id)
    return _to_out(dibujo, accion.Ticker if accion else payload.symbol)


@router.delete("/{drawing_id}", status_code=204)
def delete_drawing(
    drawing_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> None:
    repo = DibujosRepository(db)
    dibujo = repo.get_owned(user.C005Id, drawing_id)
    if dibujo is None:
        return  # idempotente
    repo.soft_delete(dibujo)
    db.commit()
