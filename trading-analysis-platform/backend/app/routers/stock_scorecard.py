"""Executive Stock Scorecard (Fase 1).

GET /api/stocks/{symbol}/scorecard — resumen ejecutivo del simbolo activo a
partir de datos YA disponibles (tecnico, fundamentales basicos de Yahoo,
noticias del simbolo, proxies de sentimiento). Requiere usuario autenticado;
el contexto del usuario (notas/operaciones) se acota por C005Id. NO es asesoria
financiera.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.security.dependencies import get_current_active_user
from app.services.stock_scorecard_service import (
    ScorecardUnavailable,
    build_stock_scorecard,
)

logger = logging.getLogger("stock_scorecard")

router = APIRouter(prefix="/stocks", tags=["Stock Scorecard"])


@router.get("/{symbol}/scorecard")
def get_stock_scorecard(
    symbol: str,
    forceRefresh: bool = Query(False),
    workspaceId: int | None = Query(None),
    focusedChartSlotId: str | None = Query(None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    try:
        return build_stock_scorecard(
            db,
            user.C005Id,
            symbol,
            workspace_id=workspaceId,
            focused_chart_slot_id=focusedChartSlotId,
            force_refresh=forceRefresh,
        )
    except ScorecardUnavailable as exc:
        raise HTTPException(
            status_code=404, detail="Scorecard unavailable for this symbol."
        ) from exc
    except Exception as exc:  # noqa: BLE001 - nunca tira el dashboard
        logger.warning(
            "Error construyendo scorecard de %s: %s", symbol, type(exc).__name__
        )
        raise HTTPException(
            status_code=500, detail="Could not build scorecard."
        ) from exc
