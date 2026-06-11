"""Noticias de mercado (cache SQL C060/C061 + providers). Requiere login."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.security.dependencies import get_current_active_user
from app.services.news import news_service as news_orchestrator
from app.services.news.news_types import CATEGORIES

router = APIRouter(prefix="/news", tags=["News"])


class RefreshGlobalRequest(BaseModel):
    category: str | None = None


@router.get("/categories")
def list_categories(
    user: Usuario = Depends(get_current_active_user),
) -> list[str]:
    return ["All", *CATEGORIES]


@router.get("/global")
def get_global_news(
    category: str | None = Query(default=None),
    source: str | None = Query(default=None, pattern="^(all|yahoo|google)?$"),
    limit: int = Query(default=50, ge=1, le=100),
    forceRefresh: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    return news_orchestrator.get_global_news(
        db,
        category=category,
        limit=limit,
        force_refresh=forceRefresh,
        source=None if source in (None, "all") else source,
    )


@router.get("/top-trending-stocks-today")
def get_top_trending_stocks_today(
    limit: int = Query(default=30, ge=1, le=50),
    forceRefresh: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    return news_orchestrator.get_top_trending_stock_news(
        db, limit=limit, force_refresh=forceRefresh
    )


@router.get("/symbol/{symbol}")
def get_symbol_news(
    symbol: str,
    limit: int = Query(default=30, ge=1, le=100),
    forceRefresh: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    return news_orchestrator.get_symbol_news(
        db, symbol, limit=limit, force_refresh=forceRefresh
    )


@router.post("/refresh-global")
def refresh_global_news(
    payload: RefreshGlobalRequest | None = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    category = payload.category if payload else None
    return news_orchestrator.get_global_news(
        db, category=category, limit=50, force_refresh=True
    )


@router.post("/refresh-symbol/{symbol}")
def refresh_symbol_news(
    symbol: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    return news_orchestrator.get_symbol_news(db, symbol, limit=30, force_refresh=True)
