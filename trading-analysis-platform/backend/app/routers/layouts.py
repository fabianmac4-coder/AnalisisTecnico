"""Layout default por usuario respaldado en SQL (dbo.C030).

ConfiguracionJSON guarda el objeto ChartLayout completo del frontend.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.repositories.layouts_repository import LayoutsRepository
from app.security.dependencies import get_current_active_user

router = APIRouter(prefix="/layouts", tags=["layouts"])


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
