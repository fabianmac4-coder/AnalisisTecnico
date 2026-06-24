"""Preferencias de usuario (C092). Primer uso: la PLANTILLA por defecto de las
seis graficas que se aplica a stocks/workspaces nuevos. Acotado por C005Id.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.chart_workspaces import (
    CHART_SLOT_IDS,
    DEFAULT_CHART_LAYOUT_TEMPLATE_KEY,
    DEFAULT_CHART_SLOTS,
    normalize_chart_slots,
    validate_template_slots,
)
from app.database import get_db
from app.models import Usuario
from app.repositories.user_preferences_repository import UserPreferencesRepository
from app.security.dependencies import get_current_active_user

router = APIRouter(prefix="/user-preferences", tags=["user-preferences"])


class ChartSlotIn(BaseModel):
    slotId: str
    range: str
    interval: str
    label: str | None = None


class ChartLayoutTemplateIn(BaseModel):
    chartSlots: list[ChartSlotIn] = Field(default_factory=list)


class ChartLayoutTemplateOut(BaseModel):
    # "USER" = el usuario guardó su propia plantilla; "SYSTEM" = default del sistema.
    source: str
    chartSlots: list[dict]
    # Compat: redundante con source; se conserva para clientes previos.
    isUserTemplate: bool


def _template_out(chart_slots: list[dict], is_user: bool) -> ChartLayoutTemplateOut:
    return ChartLayoutTemplateOut(
        source="USER" if is_user else "SYSTEM",
        chartSlots=chart_slots,
        isUserTemplate=is_user,
    )


def load_default_chart_slots(db: Session, user_id: int) -> list[dict]:
    """Slots de la plantilla del usuario (saneados) o los del sistema. Sin red.

    Lo consume el router de layouts al crear workspaces. Nunca lanza.
    """
    pref = UserPreferencesRepository(db).get_active(
        user_id, DEFAULT_CHART_LAYOUT_TEMPLATE_KEY
    )
    if pref is None:
        return [dict(s) for s in DEFAULT_CHART_SLOTS]
    try:
        data = json.loads(pref.ValorJSON)
        return normalize_chart_slots(data.get("chartSlots"))
    except (ValueError, TypeError):
        return [dict(s) for s in DEFAULT_CHART_SLOTS]


@router.get("/default-chart-layout-template", response_model=ChartLayoutTemplateOut)
def get_default_chart_layout_template(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> ChartLayoutTemplateOut:
    pref = UserPreferencesRepository(db).get_active(
        user.C005Id, DEFAULT_CHART_LAYOUT_TEMPLATE_KEY
    )
    return _template_out(
        load_default_chart_slots(db, user.C005Id), is_user=pref is not None
    )


@router.post("/default-chart-layout-template", response_model=ChartLayoutTemplateOut)
def save_default_chart_layout_template(
    payload: ChartLayoutTemplateIn,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> ChartLayoutTemplateOut:
    slots = [s.model_dump(exclude_none=True) for s in payload.chartSlots]
    error = validate_template_slots(slots)
    if error is not None:
        raise HTTPException(status_code=422, detail=error)
    value = json.dumps({"version": 1, "chartSlots": slots})
    UserPreferencesRepository(db).upsert(
        user.C005Id, DEFAULT_CHART_LAYOUT_TEMPLATE_KEY, value
    )
    db.commit()
    return _template_out(normalize_chart_slots(slots), is_user=True)


@router.delete("/default-chart-layout-template", response_model=ChartLayoutTemplateOut)
def reset_default_chart_layout_template(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> ChartLayoutTemplateOut:
    """Restablece la plantilla del sistema (borrado suave de la del usuario)."""
    UserPreferencesRepository(db).deactivate(
        user.C005Id, DEFAULT_CHART_LAYOUT_TEMPLATE_KEY
    )
    db.commit()
    return _template_out([dict(s) for s in DEFAULT_CHART_SLOTS], is_user=False)


# Exporta los ids para validacion del frontend si hiciera falta.
__all__ = ["router", "load_default_chart_slots", "CHART_SLOT_IDS"]
