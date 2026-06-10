"""Endpoints de datos de mercado."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.schemas.market import OHLCVResponse, QuoteResponse
from app.services import yahoo_service
from app.timeframes import PRESETS_BY_KEY

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/quote", response_model=QuoteResponse)
def get_quote(
    symbol: str = Query(..., min_length=1, description="Ticker, ej. AAPL"),
) -> QuoteResponse:
    """Cotizacion canonica: fuente unica del 'precio actual' del simbolo."""
    try:
        return yahoo_service.get_quote(symbol)
    except yahoo_service.SymbolNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except yahoo_service.MarketDataError as exc:
        raise HTTPException(
            status_code=502, detail=f"Error de proveedor: {exc}"
        ) from exc


@router.get("/ohlcv", response_model=OHLCVResponse)
def get_ohlcv(
    symbol: str = Query(..., min_length=1, description="Ticker, ej. AAPL"),
    preset: str = Query(..., description="Clave de preset, ej. 1Y_1D"),
    includeWarmup: bool = Query(
        False, description="Incluir velas previas para indicadores"
    ),
    warmupBars: int = Query(
        260, ge=0, le=600, description="Cuantas velas de warmup pedir"
    ),
) -> OHLCVResponse:
    if preset not in PRESETS_BY_KEY:
        raise HTTPException(status_code=400, detail=f"Preset invalido: {preset}")
    try:
        return yahoo_service.get_ohlcv(
            symbol, preset, include_warmup=includeWarmup, warmup_bars=warmupBars
        )
    except yahoo_service.SymbolNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except yahoo_service.MarketDataError as exc:
        raise HTTPException(status_code=502, detail=f"Error de proveedor: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/presets")
def list_presets() -> list[dict]:
    """Expone los presets para que el frontend pueda validar/alinear."""
    return [
        {
            "key": p.key,
            "label": p.label,
            "interval": p.interval,
            "chartIntervalLabel": p.chart_interval_label,
            "intraday": p.intraday,
            "period": p.period,
        }
        for p in PRESETS_BY_KEY.values()
    ]
