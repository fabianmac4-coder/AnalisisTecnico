"""Layouts y workspaces de analisis respaldados en SQL (dbo.C030).

- `/layouts/default` (GLOBAL, C010Id NULL): preferencias de UI heredadas.
- `/layouts/stock/{symbol}` y `/layouts/{c030Id}/*`: workspaces por accion. Cada
  fila C030 es un workspace con seis slots de grafica en ConfiguracionJSON.

Todos los handlers exigen usuario autenticado y acotan por C005Id.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.chart_workspaces import (
    DEFAULT_WORKSPACE_NAME,
    default_workspace_configuration,
    merge_chart_slots,
    normalize_chart_slots,
)
from app.database import get_db
from app.models import Accion, LayoutGrafica, Usuario
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.layouts_repository import LayoutsRepository
from app.schemas.layouts import (
    ChartSlotConfig,
    ChartSlotsUpdate,
    WorkspaceCreate,
    WorkspaceOut,
    WorkspaceUpdate,
)
from app.security.dependencies import get_current_active_user

router = APIRouter(prefix="/layouts", tags=["layouts"])


# --------------------------------------------------------------- layout global
@router.get("/default")
def get_default_layout(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict[str, Any]:
    layout = LayoutsRepository(db).get_default_by_user(user.C005Id)
    if layout is None:
        raise HTTPException(status_code=404, detail="No hay layout por defecto guardado")
    try:
        return json.loads(layout.ConfiguracionJSON)
    except (TypeError, ValueError):
        raise HTTPException(status_code=500, detail="Layout corrupto") from None


@router.put("/default")
def save_default_layout(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict[str, Any]:
    LayoutsRepository(db).upsert_default(user.C005Id, payload)
    db.commit()
    return payload


# ------------------------------------------------------------------- helpers
def _parse_config(ws: LayoutGrafica) -> dict[str, Any]:
    try:
        cfg = json.loads(ws.ConfiguracionJSON)
    except (TypeError, ValueError):
        cfg = {}
    return cfg if isinstance(cfg, dict) else {}


def _to_out(ws: LayoutGrafica, accion: Accion) -> WorkspaceOut:
    cfg = _parse_config(ws)
    slots = normalize_chart_slots(cfg.get("chartSlots"))
    cfg["chartSlots"] = slots
    cfg["symbol"] = accion.Ticker
    cfg["c010Id"] = ws.C010Id
    cfg["workspaceName"] = ws.NombreLayout
    return WorkspaceOut(
        c030Id=ws.C030Id,
        name=ws.NombreLayout,
        isDefault=bool(ws.EsDefault),
        symbol=accion.Ticker,
        c010Id=ws.C010Id,
        chartSlots=[ChartSlotConfig(**s) for s in slots],
        configuration=cfg,
        createdAt=ws.FechaCreacion.isoformat() if ws.FechaCreacion else None,
        updatedAt=ws.FechaActualizacion.isoformat() if ws.FechaActualizacion else None,
    )


def _owned_workspace(
    repo: LayoutsRepository, user_id: int, c030_id: int
) -> LayoutGrafica:
    ws = repo.get_workspace(user_id, c030_id)
    if ws is None or ws.C010Id is None:
        raise HTTPException(status_code=404, detail="Workspace no encontrado")
    return ws


# ------------------------------------------------------------------ workspaces
@router.get("/stock/{symbol}", response_model=list[WorkspaceOut])
def list_stock_workspaces(
    symbol: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[WorkspaceOut]:
    """Workspaces del usuario para el simbolo. Crea el default si no hay ninguno."""
    accion = AccionesRepository(db).get_or_create_from_yahoo_symbol(symbol)
    repo = LayoutsRepository(db)
    workspaces = repo.list_workspaces(user.C005Id, accion.C010Id)
    if not workspaces:
        cfg = default_workspace_configuration(
            accion.Ticker, accion.C010Id, DEFAULT_WORKSPACE_NAME
        )
        ws = repo.create_workspace(
            user.C005Id, accion.C010Id, DEFAULT_WORKSPACE_NAME, cfg, es_default=True
        )
        workspaces = [ws]
    db.commit()
    return [_to_out(ws, accion) for ws in workspaces]


@router.post("/stock/{symbol}", response_model=WorkspaceOut, status_code=201)
def create_stock_workspace(
    symbol: str,
    payload: WorkspaceCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> WorkspaceOut:
    accion = AccionesRepository(db).get_or_create_from_yahoo_symbol(symbol)
    repo = LayoutsRepository(db)
    existing = repo.list_workspaces(user.C005Id, accion.C010Id)
    is_first = len(existing) == 0

    if payload.copyFromC030Id is not None:
        source = _owned_workspace(repo, user.C005Id, payload.copyFromC030Id)
        cfg = _parse_config(source)
        cfg["chartSlots"] = normalize_chart_slots(cfg.get("chartSlots"))
    else:
        cfg = default_workspace_configuration(
            accion.Ticker, accion.C010Id, payload.name
        )
    cfg["workspaceName"] = payload.name
    cfg["symbol"] = accion.Ticker
    cfg["c010Id"] = accion.C010Id

    ws = repo.create_workspace(
        user.C005Id, accion.C010Id, payload.name, cfg, es_default=is_first
    )
    db.commit()
    return _to_out(ws, accion)


@router.patch("/{c030_id}", response_model=WorkspaceOut)
def update_workspace(
    c030_id: int,
    payload: WorkspaceUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> WorkspaceOut:
    repo = LayoutsRepository(db)
    ws = _owned_workspace(repo, user.C005Id, c030_id)
    cfg = _parse_config(ws)

    # Nombre: recorta espacios y rechaza vacio (no permitir renombrar a "").
    new_name: str | None = None
    if payload.name is not None:
        new_name = payload.name.strip()
        if not new_name:
            raise HTTPException(
                status_code=400, detail="El nombre no puede estar vacio."
            )

    if payload.chartSlots is not None:
        cfg["chartSlots"] = merge_chart_slots(
            cfg.get("chartSlots"),
            [s.model_dump(exclude_none=True) for s in payload.chartSlots],
        )
    if payload.configuration is not None:
        # Merge superficial: no pisa chartSlots salvo que vengan explicitos.
        merged = {**cfg, **payload.configuration}
        if payload.chartSlots is not None:
            merged["chartSlots"] = cfg["chartSlots"]
        cfg = merged
    if new_name is not None:
        cfg["workspaceName"] = new_name

    repo.update_workspace(ws, name=new_name, configuracion=cfg)
    if payload.isDefault is True:
        repo.set_default(user.C005Id, ws)
    db.commit()
    accion = AccionesRepository(db).get_by_id(ws.C010Id)
    return _to_out(ws, accion)


@router.patch("/{c030_id}/chart-slots", response_model=WorkspaceOut)
def update_chart_slots(
    c030_id: int,
    payload: ChartSlotsUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> WorkspaceOut:
    """Actualiza SOLO chartSlots, preservando el resto de ConfiguracionJSON."""
    repo = LayoutsRepository(db)
    ws = _owned_workspace(repo, user.C005Id, c030_id)
    cfg = _parse_config(ws)
    cfg["chartSlots"] = merge_chart_slots(
        cfg.get("chartSlots"),
        [s.model_dump(exclude_none=True) for s in payload.chartSlots],
    )
    repo.update_workspace(ws, configuracion=cfg)
    db.commit()
    accion = AccionesRepository(db).get_by_id(ws.C010Id)
    return _to_out(ws, accion)


@router.patch("/{c030_id}/set-default", response_model=WorkspaceOut)
def set_default_workspace(
    c030_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> WorkspaceOut:
    repo = LayoutsRepository(db)
    ws = _owned_workspace(repo, user.C005Id, c030_id)
    repo.set_default(user.C005Id, ws)
    db.commit()
    accion = AccionesRepository(db).get_by_id(ws.C010Id)
    return _to_out(ws, accion)


@router.delete("/{c030_id}", status_code=204)
def delete_workspace(
    c030_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> None:
    """Borrado suave del workspace. Nunca toca dibujos/indicadores/operaciones/IA.

    Bloquea el borrado del ultimo workspace (siempre debe quedar al menos uno).
    """
    repo = LayoutsRepository(db)
    ws = _owned_workspace(repo, user.C005Id, c030_id)
    siblings = repo.list_workspaces(user.C005Id, ws.C010Id)
    if len(siblings) <= 1:
        raise HTTPException(
            status_code=409,
            detail="Se requiere al menos un workspace de analisis.",
        )
    repo.soft_delete(ws)
    repo.ensure_a_default(user.C005Id, ws.C010Id)
    db.commit()
