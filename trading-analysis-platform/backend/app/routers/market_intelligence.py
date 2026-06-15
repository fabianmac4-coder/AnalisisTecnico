"""Router de Inteligencia de Mercado (Fase 2).

Overview agregado + sentimiento (proxy Fear & Greed). Cache compartido en C080.
Todos los endpoints requieren usuario autenticado activo.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config import env_settings
from app.database import get_db
from app.models import Usuario
from app.security.dependencies import get_current_active_user
from app.services import market_intelligence_service
from app.services.sentiment import sentiment_service

router = APIRouter(prefix="/market-intelligence", tags=["Market Intelligence"])


@router.get("/overview")
def get_overview(
    forceRefresh: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    if not env_settings.ENABLE_MARKET_INTELLIGENCE:
        return {
            "indices": [],
            "sentiment": {"score": None, "label": "UNAVAILABLE", "components": []},
            "fearGreed": {"enabled": False, "value": None},
            "marketMoversSummary": {
                "topGainers": [], "topLosers": [], "mostActive": [], "trending": []
            },
            "topNews": [],
            "whatThisMeans": [],
            "lastUpdated": None,
            "warnings": ["Market Intelligence is disabled."],
        }
    return market_intelligence_service.get_overview(db, force_refresh=forceRefresh)


@router.get("/sentiment")
def get_sentiment(
    forceRefresh: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    if not env_settings.ENABLE_MARKET_SENTIMENT:
        return {
            "score": None, "label": "UNAVAILABLE", "confidence": "LOW",
            "source": "disabled", "components": [],
            "warnings": ["Market sentiment is disabled."],
        }
    return sentiment_service.compute_sentiment(db, force_refresh=forceRefresh)
