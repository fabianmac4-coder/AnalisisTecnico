"""Router del Macro Dashboard (Fase 3). Cache compartido en C080.

Todos los endpoints requieren usuario autenticado activo.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config import env_settings
from app.database import get_db
from app.models import Usuario
from app.security.dependencies import get_current_active_user
from app.services import macro as macro_service

router = APIRouter(prefix="/macro", tags=["Macro"])


@router.get("/overview")
def get_overview(
    forceRefresh: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    if not env_settings.ENABLE_MACRO_DASHBOARD:
        return {
            "executiveSummary": {
                "riskLevel": "UNKNOWN", "riskLabel": "Macro deshabilitado",
                "summary": "", "lastUpdated": None,
            },
            "macroRisk": {"riskLevel": "UNKNOWN", "score": None, "drivers": [], "risks": []},
            "usaIndicators": {},
            "rates": {"curveStatus": "UNKNOWN"},
            "globalMarkets": {"fx": [], "commodities": [], "crypto": []},
            "economicCalendar": [],
            "economicCalendarAvailable": False,
            "economicCalendarSource": "UNAVAILABLE",
            "whatThisMeans": [],
            "dataAvailability": {
                "macroProviderConfigured": False, "ratesAvailable": False,
                "globalMarketsAvailable": False, "calendarAvailable": False,
            },
            "warnings": ["Macro Dashboard is disabled."],
            "lastUpdated": None,
        }
    return macro_service.get_overview(db, force_refresh=forceRefresh)
