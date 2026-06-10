"""Endpoints de busqueda/validacion de simbolos."""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas.symbols import SymbolSearchResponse
from app.services import yahoo_service

router = APIRouter(prefix="/symbols", tags=["symbols"])


@router.get("/search", response_model=SymbolSearchResponse)
def search(q: str = Query(..., min_length=1, description="Ticker a buscar")) -> SymbolSearchResponse:
    results = yahoo_service.search_symbols(q)
    return SymbolSearchResponse(query=q.strip().upper(), results=results)
