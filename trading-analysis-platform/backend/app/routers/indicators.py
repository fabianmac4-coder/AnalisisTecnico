"""Configuraciones GLOBALES de indicadores por usuario (dbo.C020, C010Id NULL).

GET devuelve la lista en la forma GlobalIndicatorConfig del frontend.
PUT reemplaza el set completo (upsert por nombre + poda de los eliminados).
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.repositories.indicadores_repository import IndicadoresRepository
from app.security.dependencies import get_current_active_user

router = APIRouter(prefix="/indicators", tags=["indicators"])


class IndicatorConfigIO(BaseModel):
    """Forma GlobalIndicatorConfig del frontend."""

    id: str = Field(min_length=1)
    type: str
    name: str
    visible: bool = False
    applyToAllTimeframes: bool = True
    params: dict[str, Any] = Field(default_factory=dict)
    style: dict[str, Any] = Field(default_factory=dict)


def _safe_json(value: str | None, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


@router.get("", response_model=list[IndicatorConfigIO])
def get_indicators(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[IndicatorConfigIO]:
    rows = IndicadoresRepository(db).list_by_user_and_action_or_global(user.C005Id)
    out: list[IndicatorConfigIO] = []
    for row in rows:
        params = _safe_json(row.ParametrosJSON, {})
        out.append(
            IndicatorConfigIO(
                id=row.NombreIndicador,
                type=row.TipoIndicador,
                name=params.pop("_displayName", row.NombreIndicador),
                visible=bool(row.Visible),
                applyToAllTimeframes=bool(row.AplicarTodasTemporalidades),
                params=params,
                style=_safe_json(row.EstiloJSON, {}),
            )
        )
    return out


@router.put("", response_model=list[IndicatorConfigIO])
def put_indicators(
    payload: list[IndicatorConfigIO],
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> list[IndicatorConfigIO]:
    repo = IndicadoresRepository(db)
    incoming_ids = {cfg.id for cfg in payload}

    # Poda configs globales que ya no estan en el set.
    for row in repo.list_by_user_and_action_or_global(user.C005Id):
        if row.NombreIndicador not in incoming_ids:
            repo.delete(user.C005Id, row.C020Id)

    for cfg in payload:
        params = dict(cfg.params)
        params["_displayName"] = cfg.name  # conserva el nombre visible
        repo.upsert(
            user_id=user.C005Id,
            nombre=cfg.id,
            tipo=cfg.type,
            visible=cfg.visible,
            aplicar_todas=cfg.applyToAllTimeframes,
            params=params,
            estilo=cfg.style,
            c010_id=None,
        )
    db.commit()
    return payload
