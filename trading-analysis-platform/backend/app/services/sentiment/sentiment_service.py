"""Orquestador del sentimiento de mercado (proxy interno, con cache C080).

Reúne los insumos best-effort (VIX + tendencia de índices + breadth de movers +
tono de noticias), llama al proveedor por defecto y cachea el resultado. Nunca
lanza: si todo falla devuelve un resultado UNAVAILABLE con warning.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import env_settings
from app.repositories.market_cache_repository import MarketCacheRepository
from app.services import yahoo_service
from app.services.sentiment.internal_market_sentiment_provider import (
    InternalMarketSentimentProvider,
)
from app.services.sentiment.sentiment_types import (
    IndexTrendInput,
    SentimentInputs,
)

CACHE_TYPE = "MARKET_SENTIMENT"
CACHE_KEY = "global"

_PROVIDER = InternalMarketSentimentProvider()


def _safe_quote(symbol: str):
    try:
        return yahoo_service.get_quote(symbol)
    except Exception:  # noqa: BLE001
        return None


def _short_avg(symbol: str) -> tuple[float | None, float | None]:
    """(last_close, sma10) best-effort a partir de velas diarias recientes."""
    try:
        resp = yahoo_service.get_ohlcv(symbol, "3M_1D")
        closes = [b.close for b in resp.bars if b.close is not None]
        if not closes:
            return None, None
        last = closes[-1]
        window = closes[-10:]
        avg = sum(window) / len(window) if window else None
        return last, avg
    except Exception:  # noqa: BLE001
        return None, None


def _index_input(symbol: str, name: str) -> IndexTrendInput | None:
    quote = _safe_quote(symbol)
    last_close, short_avg = _short_avg(symbol)
    if quote is None and last_close is None:
        return None
    return IndexTrendInput(
        symbol=symbol,
        name=name,
        change_percent=quote.changePercent if quote else None,
        last_close=last_close,
        short_avg=short_avg,
    )


def gather_inputs(
    movers_breadth: tuple[int, int] | None = None,
    news_tone: float | None = None,
) -> SentimentInputs:
    """Construye los insumos del proveedor (cada fetch es best-effort)."""
    vix_quote = _safe_quote("^VIX")
    inputs = SentimentInputs(
        vix=vix_quote.price if vix_quote else None,
        sp500=_index_input("^GSPC", "S&P 500"),
        nasdaq=_index_input("^IXIC", "NASDAQ"),
        russell=_index_input("^RUT", "Russell 2000"),
        news_tone=news_tone,
    )
    if movers_breadth is not None:
        inputs.gainers_count, inputs.losers_count = movers_breadth
    return inputs


def compute_sentiment(
    db: Session | None = None,
    force_refresh: bool = False,
    *,
    movers_breadth: tuple[int, int] | None = None,
    news_tone: float | None = None,
    use_cache: bool = True,
) -> dict:
    """Devuelve el sentimiento como dict. Usa cache C080 si hay sesión."""
    ttl = env_settings.MARKET_SENTIMENT_TTL_MINUTES
    if db is not None and use_cache and not force_refresh:
        cached = MarketCacheRepository(db).get_fresh(CACHE_TYPE, CACHE_KEY)
        if cached is not None:
            cached["fromCache"] = True
            return cached

    inputs = gather_inputs(movers_breadth=movers_breadth, news_tone=news_tone)
    result = _PROVIDER.compute(inputs).to_dict()
    result["fromCache"] = False

    if db is not None and result.get("score") is not None:
        try:
            MarketCacheRepository(db).store(
                CACHE_TYPE, _PROVIDER.name, CACHE_KEY, result, ttl
            )
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
    return result
