"""Schemas de datos de mercado (OHLCV)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class Candle(BaseModel):
    # Unix milliseconds en UTC.
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None


class OHLCVResponse(BaseModel):
    symbol: str
    preset: str
    interval: str
    # Siempre "raw": usamos precios sin ajustar (auto_adjust=False), nunca Adj Close.
    priceBasis: str = "raw"
    currency: str | None = None
    timezone: str | None = None
    # Zona horaria del MERCADO/exchange (para mostrar etiquetas tipo TradingView).
    # `dataTimezone` declara que los timestamps de las velas SIEMPRE son UTC ms:
    # la zona horaria solo afecta el FORMATO de las etiquetas, nunca los datos.
    exchangeTimezone: str | None = None
    dataTimezone: str = "UTC"
    # Velas VISIBLES del preset (las que pinta la grafica).
    bars: list[Candle] = Field(default_factory=list)
    # Velas previas SOLO para calculo de indicadores (SMA 200, etc.).
    # Nunca se pintan como candles.
    warmupBars: list[Candle] = Field(default_factory=list)
    visibleFrom: int | None = None  # Unix ms UTC
    visibleTo: int | None = None  # Unix ms UTC


class QuoteResponse(BaseModel):
    """Cotizacion canonica del simbolo. Fuente unica del 'precio actual'."""

    symbol: str
    price: float
    previousClose: float | None = None
    change: float | None = None
    changePercent: float | None = None
    currency: str | None = None
    marketState: str | None = None
    source: str = "yfinance"
    timestamp: int  # Unix ms UTC


class HealthResponse(BaseModel):
    status: str = "ok"
    app: str
