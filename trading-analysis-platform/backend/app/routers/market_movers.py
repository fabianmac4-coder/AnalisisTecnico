"""Market movers (snapshots SQL C062/C063 + provider Yahoo). Requiere login."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.security.dependencies import get_current_active_user
from app.services.market_movers import market_movers_service

router = APIRouter(prefix="/market-movers", tags=["Market Movers"])

_LIST_BY_SLUG = {
    "trending": "TRENDING",
    "top-gainers": "TOP_GAINERS",
    "top-losers": "TOP_LOSERS",
    "most-active": "MOST_ACTIVE",
}


@router.get("")
def get_all_movers(
    forceRefresh: bool = Query(default=False),
    limit: int = Query(default=25, ge=1, le=50),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    return market_movers_service.get_all_lists(db, limit=limit, force_refresh=forceRefresh)


@router.post("/refresh")
def refresh_all_movers(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    return market_movers_service.get_all_lists(db, limit=25, force_refresh=True)


@router.get("/{list_slug}")
def get_one_list(
    list_slug: str,
    forceRefresh: bool = Query(default=False),
    limit: int = Query(default=25, ge=1, le=50),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> dict:
    list_type = _LIST_BY_SLUG.get(list_slug)
    if list_type is None:
        raise HTTPException(status_code=400, detail=f"Lista inválida: {list_slug}")
    payload, warnings = market_movers_service.get_list(
        db, list_type, limit=limit, force_refresh=forceRefresh
    )
    return {"listType": list_type, **payload, "warnings": warnings}
