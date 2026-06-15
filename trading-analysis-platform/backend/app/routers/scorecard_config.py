"""Configuracion de puntuacion del Stock Scorecard (dbo.C081).

Endpoints bajo /api/scorecard/configs (auth; todo acotado por C005Id). El
usuario personaliza pesos y umbrales; el scorecard usa su config default.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ConfiguracionScorecard, Usuario
from app.repositories.scorecard_config_repository import ScorecardConfigRepository
from app.schemas.scorecard import (
    ScorecardConfigCreate,
    ScorecardConfigOut,
    ScorecardConfigUpdate,
)
from app.security.dependencies import get_current_active_user
from app.services.scorecard_config import (
    DEFAULT_SCORECARD_CONFIG,
    InvalidScorecardConfig,
    merge_with_default,
    validate_config,
)

router = APIRouter(prefix="/scorecard", tags=["Stock Scorecard"])


def _validated(config: dict) -> dict:
    """Funde con el default y valida (pesos suman 100, umbrales numéricos)."""
    merged = merge_with_default(config)
    try:
        validate_config(merged)
    except InvalidScorecardConfig as exc:
        raise HTTPException(
            status_code=422,
            detail={"error": "INVALID_SCORECARD_CONFIG", "message": str(exc)},
        ) from exc
    return merged


def _parse(row: ConfiguracionScorecard) -> dict:
    try:
        return json.loads(row.ConfiguracionJSON)
    except (TypeError, ValueError):
        return {}


def _to_out(row: ConfiguracionScorecard) -> ScorecardConfigOut:
    return ScorecardConfigOut(
        c081Id=row.C081Id,
        name=row.NombreConfiguracion,
        isDefault=bool(row.EsDefault),
        # Devuelve la config COMPLETA (fundida con el default) para la UI.
        configuration=merge_with_default(_parse(row)),
        createdAt=row.FechaCreacion.isoformat() if row.FechaCreacion else None,
        updatedAt=row.FechaActualizacion.isoformat() if row.FechaActualizacion else None,
    )


@router.get("/configs", response_model=list[ScorecardConfigOut])
def list_configs(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[ScorecardConfigOut]:
    repo = ScorecardConfigRepository(db)
    rows = repo.list_active(user.C005Id)
    if not rows:
        rows = [repo.get_or_create_default(user.C005Id)]
        db.commit()
    return [_to_out(r) for r in rows]


@router.get("/configs/default", response_model=ScorecardConfigOut)
def get_default_config(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> ScorecardConfigOut:
    repo = ScorecardConfigRepository(db)
    row = repo.get_or_create_default(user.C005Id)
    db.commit()
    return _to_out(row)


@router.post("/configs", response_model=ScorecardConfigOut, status_code=201)
def create_config(
    payload: ScorecardConfigCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> ScorecardConfigOut:
    repo = ScorecardConfigRepository(db)
    if payload.copyFromC081Id is not None:
        source = repo.get_owned(user.C005Id, payload.copyFromC081Id)
        if source is None:
            raise HTTPException(status_code=404, detail="Configuración no encontrada")
        config = merge_with_default(_parse(source))
    elif payload.configuration is not None:
        config = _validated(payload.configuration)
    else:
        config = dict(DEFAULT_SCORECARD_CONFIG)
    is_first = repo.count_active(user.C005Id) == 0
    row = repo.create(user.C005Id, payload.name, config, es_default=is_first)
    db.commit()
    return _to_out(row)


@router.patch("/configs/{c081_id}", response_model=ScorecardConfigOut)
def update_config(
    c081_id: int,
    payload: ScorecardConfigUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> ScorecardConfigOut:
    repo = ScorecardConfigRepository(db)
    row = repo.get_owned(user.C005Id, c081_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    name = payload.name.strip() if payload.name is not None else None
    if payload.name is not None and not name:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío.")
    config = (
        _validated(payload.configuration) if payload.configuration is not None else None
    )
    repo.update(row, name=name, config=config)
    db.commit()
    return _to_out(row)


@router.post("/configs/reset-default", response_model=ScorecardConfigOut)
def reset_default_config(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> ScorecardConfigOut:
    """Restaura la config DEFAULT del usuario a los valores del sistema."""
    repo = ScorecardConfigRepository(db)
    row = repo.get_or_create_default(user.C005Id)
    repo.update(row, config=dict(DEFAULT_SCORECARD_CONFIG))
    db.commit()
    return _to_out(row)


@router.patch("/configs/{c081_id}/set-default", response_model=ScorecardConfigOut)
def set_default_config(
    c081_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> ScorecardConfigOut:
    repo = ScorecardConfigRepository(db)
    row = repo.get_owned(user.C005Id, c081_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    repo.set_default(user.C005Id, row)
    db.commit()
    return _to_out(row)


@router.delete("/configs/{c081_id}", status_code=204)
def delete_config(
    c081_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> None:
    repo = ScorecardConfigRepository(db)
    row = repo.get_owned(user.C005Id, c081_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    if repo.count_active(user.C005Id) <= 1:
        raise HTTPException(
            status_code=409, detail="Se requiere al menos una configuración."
        )
    repo.soft_delete(row)
    repo.ensure_a_default(user.C005Id)
    db.commit()
