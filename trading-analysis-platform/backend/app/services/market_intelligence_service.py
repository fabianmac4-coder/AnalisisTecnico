"""Servicio de Inteligencia de Mercado (Fase 2).

Agrega, best-effort y con cache en C080:
- Índices principales (quote + sparkline + tendencia).
- Sentimiento / Fear & Greed (proxy interno; reutiliza el provider).
- Resumen de market movers (reutiliza el módulo existente; NO duplica C062/C063).
- Top noticias de mercado (reutiliza el módulo de noticias; NO crea storage nuevo).
- "Qué significa esto": explicación basada en reglas (sin llamadas a IA).

Ninguna falla de proveedor tumba el endpoint: devuelve datos parciales con
`warnings`, y si todo falla cae al último cache disponible.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import env_settings
from app.repositories.market_cache_repository import MarketCacheRepository
from app.services import yahoo_service
from app.services.market_movers import market_movers_service
from app.services.news import news_service
from app.services.sentiment.internal_market_sentiment_provider import (
    InternalMarketSentimentProvider,
)
from app.services.sentiment.sentiment_types import IndexTrendInput, SentimentInputs

CACHE_TYPE = "MARKET_INTELLIGENCE_OVERVIEW"
CACHE_KEY = "global"
PROVIDER = "market_intelligence_service"

# Índices principales (símbolo Yahoo, nombre legible). El VIX entra como índice
# Y como componente de sentimiento.
INDICES: list[tuple[str, str]] = [
    ("^GSPC", "S&P 500"),
    ("^IXIC", "NASDAQ Composite"),
    ("^DJI", "Dow Jones Industrial Average"),
    ("^RUT", "Russell 2000"),
    ("^VIX", "VIX (volatilidad)"),
    ("^FTSE", "FTSE 100"),
    ("^GDAXI", "DAX"),
    ("^N225", "Nikkei 225"),
]

_POS_WORDS = ("rally", "surge", "gains", "beats", "jumps", "soars", "record",
              "optimism", "rebound", "higher", "tops")
_NEG_WORDS = ("plunge", "crash", "fears", "slump", "recession", "selloff",
              "sell-off", "tumble", "warns", "cuts", "lower", "drop", "fall")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _candles(symbol: str) -> tuple[list[float], list[dict]]:
    """(closes, sparkline) best-effort a partir de 3M diario."""
    try:
        resp = yahoo_service.get_ohlcv(symbol, "3M_1D")
        closes = [b.close for b in resp.bars if b.close is not None]
        sparkline = [
            {"time": int(b.time // 1000), "value": b.close}
            for b in resp.bars[-30:]
            if b.close is not None
        ]
        return closes, sparkline
    except Exception:  # noqa: BLE001
        return [], []


def _fetch_index(symbol: str, name: str) -> dict | None:
    try:
        quote = yahoo_service.get_quote(symbol)
    except Exception:  # noqa: BLE001
        quote = None
    closes, sparkline = _candles(symbol)
    if quote is None and not closes:
        return None
    price = quote.price if quote and quote.price is not None else (
        closes[-1] if closes else None
    )
    change_pct = quote.changePercent if quote else None
    if change_pct is not None and change_pct > 0.05:
        trend = "UP"
    elif change_pct is not None and change_pct < -0.05:
        trend = "DOWN"
    else:
        trend = "FLAT"
    return {
        "symbol": symbol,
        "name": name,
        "price": price,
        "change": quote.change if quote else None,
        "changePercent": change_pct,
        "trend": trend,
        "sparkline": sparkline,
        "lastUpdated": _now_iso(),
        "_closes": closes,
    }


def _trend_input(idx: dict | None) -> IndexTrendInput | None:
    if idx is None:
        return None
    closes = idx.get("_closes") or []
    last_close = closes[-1] if closes else None
    short_avg = (sum(closes[-10:]) / len(closes[-10:])) if closes else None
    return IndexTrendInput(
        symbol=idx["symbol"],
        name=idx["name"],
        change_percent=idx.get("changePercent"),
        last_close=last_close,
        short_avg=short_avg,
    )


def _news_tone(items: list[dict]) -> float | None:
    pos = neg = 0
    for it in items:
        title = (it.get("title") or "").lower()
        if any(w in title for w in _POS_WORDS):
            pos += 1
        if any(w in title for w in _NEG_WORDS):
            neg += 1
    if pos + neg == 0:
        return None
    return (pos - neg) / (pos + neg)


def _movers_summary(db: Session, force_refresh: bool, warnings: list[str]):
    try:
        allm = market_movers_service.get_all_lists(
            db, limit=10, force_refresh=force_refresh
        )
    except Exception:  # noqa: BLE001
        warnings.append("Market movers summary unavailable.")
        return None, None
    for w in allm.get("warnings", []) or []:
        warnings.append(w)

    def top(key: str) -> list[dict]:
        return (allm.get(key) or {}).get("items", [])[:5]

    most_active = (allm.get("mostActive") or {}).get("items", [])
    base = most_active or (allm.get("trending") or {}).get("items", [])
    gainers = sum(1 for i in base if (i.get("changePercent") or 0) > 0)
    losers = sum(1 for i in base if (i.get("changePercent") or 0) < 0)
    breadth = (gainers, losers) if base else None
    summary = {
        "topGainers": top("topGainers"),
        "topLosers": top("topLosers"),
        "mostActive": top("mostActive"),
        "trending": top("trending"),
    }
    return summary, breadth


def _top_news(db: Session, force_refresh: bool, warnings: list[str]) -> list[dict]:
    try:
        res = news_service.get_global_news(
            db, limit=8, force_refresh=force_refresh
        )
    except Exception:  # noqa: BLE001
        warnings.append("News summary unavailable.")
        return []
    for w in res.get("warnings", []) or []:
        warnings.append(w)
    items = []
    for it in res.get("items", [])[:8]:
        items.append({
            "id": it.get("id"),
            "title": it.get("title"),
            "publisher": it.get("publisher"),
            "provider": it.get("provider"),
            "category": it.get("category"),
            "url": it.get("url"),
            "publishedAt": it.get("publishedAt"),
            "relevanceReason": it.get("relevanceReason"),
        })
    return items


def _fear_greed(sentiment: dict) -> dict:
    return {
        "enabled": sentiment.get("score") is not None,
        "value": sentiment.get("score"),
        "label": sentiment.get("label"),
        "source": sentiment.get("source"),
        "lastUpdated": _now_iso(),
        "components": sentiment.get("components", []),
    }


def _what_this_means(indices: list[dict], sentiment: dict, movers: dict | None) -> list[str]:
    bullets: list[str] = []
    by_symbol = {i["symbol"]: i for i in indices}
    vix = by_symbol.get("^VIX", {}).get("price")
    label = sentiment.get("label")

    up = sum(1 for i in indices if i.get("trend") == "UP" and i["symbol"] != "^VIX")
    down = sum(1 for i in indices if i.get("trend") == "DOWN" and i["symbol"] != "^VIX")
    if up > down:
        bullets.append("Los principales índices muestran sesgo positivo hoy; confírmalo con volumen y amplitud antes de actuar.")
    elif down > up:
        bullets.append("Los principales índices muestran sesgo negativo hoy; conviene mayor cautela en entradas de corto plazo.")
    else:
        bullets.append("Los índices están mixtos; el mercado no da una dirección clara hoy.")

    if vix is not None:
        if vix < 16:
            bullets.append("El VIX está bajo: hay apetito por riesgo, aunque puede reflejar complacencia.")
        elif vix > 30:
            bullets.append("El VIX está alto: reduce la confianza en setups técnicos de corto plazo.")
        else:
            bullets.append("El VIX está en zona normal/elevada: ajusta el tamaño de posición al nivel de volatilidad.")

    if label in ("GREED", "EXTREME_GREED"):
        bullets.append("El sentimiento está en codicia: evita perseguir entradas extendidas sin confirmación.")
    elif label in ("FEAR", "EXTREME_FEAR"):
        bullets.append("El sentimiento está en miedo: pueden aparecer oportunidades, pero el riesgo es mayor.")

    if movers:
        g, ls = len(movers.get("topGainers", [])), len(movers.get("topLosers", []))
        if g and ls:
            bullets.append("Revisa los movers de hoy para ver qué sectores lideran y cuáles pesan en el mercado.")

    bullets.append("La lectura del mercado debe combinarse con el Scorecard de cada acción; no es una señal de compra/venta.")
    return bullets[:5]


def get_overview(db: Session, force_refresh: bool = False) -> dict:
    """Overview agregado con cache C080. Nunca lanza."""
    repo = MarketCacheRepository(db)
    if not force_refresh:
        cached = repo.get_fresh(CACHE_TYPE, CACHE_KEY)
        if cached is not None:
            cached["fromCache"] = True
            return cached

    warnings: list[str] = []

    # 1. Índices (best-effort cada uno).
    indices_internal: list[dict] = []
    for symbol, name in INDICES:
        idx = _fetch_index(symbol, name)
        if idx is not None:
            indices_internal.append(idx)
    if not indices_internal:
        warnings.append("Major index data unavailable.")

    # 2. Movers + breadth.
    movers_summary, breadth = _movers_summary(db, force_refresh, warnings)

    # 3. Top noticias + tono.
    top_news = _top_news(db, force_refresh, warnings)
    tone = _news_tone(top_news)

    # 4. Sentimiento (reutiliza los datos de índices ya descargados).
    by_symbol = {i["symbol"]: i for i in indices_internal}
    vix_idx = by_symbol.get("^VIX")
    inputs = SentimentInputs(
        vix=vix_idx.get("price") if vix_idx else None,
        sp500=_trend_input(by_symbol.get("^GSPC")),
        nasdaq=_trend_input(by_symbol.get("^IXIC")),
        russell=_trend_input(by_symbol.get("^RUT")),
        news_tone=tone,
    )
    if breadth is not None:
        inputs.gainers_count, inputs.losers_count = breadth
    sentiment = InternalMarketSentimentProvider().compute(inputs).to_dict()
    sentiment["fromCache"] = False
    for w in sentiment.get("warnings", []) or []:
        if w not in warnings:
            warnings.append(w)

    # Cache también el sentimiento por separado (lo usa /sentiment y el Scorecard).
    if sentiment.get("score") is not None:
        try:
            repo.store("MARKET_SENTIMENT", "internal_market_sentiment_provider",
                       "global", sentiment, env_settings.MARKET_SENTIMENT_TTL_MINUTES)
        except Exception:  # noqa: BLE001
            pass

    # 5. Respuesta (sin campos internos).
    indices_out = [{k: v for k, v in i.items() if k != "_closes"} for i in indices_internal]
    overview = {
        "indices": indices_out,
        "sentiment": sentiment,
        "fearGreed": _fear_greed(sentiment),
        "marketMoversSummary": movers_summary or {
            "topGainers": [], "topLosers": [], "mostActive": [], "trending": []
        },
        "topNews": top_news,
        "whatThisMeans": _what_this_means(indices_out, sentiment, movers_summary),
        "lastUpdated": _now_iso(),
        "fromCache": False,
        "warnings": warnings,
    }

    # 6. Persistir cache (si hay algo útil). Ante fallo total, caer a cache viejo.
    has_data = bool(indices_out) or sentiment.get("score") is not None or bool(top_news)
    if has_data:
        try:
            repo.store(CACHE_TYPE, PROVIDER, CACHE_KEY, overview,
                       env_settings.MARKET_INTELLIGENCE_TTL_MINUTES)
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
        return overview

    stale = repo.get_latest_any(CACHE_TYPE, CACHE_KEY)
    if stale is not None:
        stale["fromCache"] = True
        stale.setdefault("warnings", []).append(
            "Could not refresh market overview. Showing cached data."
        )
        return stale
    overview["warnings"].append("Market Intelligence is partially available.")
    return overview
