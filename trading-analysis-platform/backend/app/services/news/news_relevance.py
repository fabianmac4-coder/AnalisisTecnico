"""Relevancia de noticias POR SIMBOLO + ranking de noticias globales.

Problema que resuelve: tickers ambiguos (OPEN, AI, ON, NOW...) coinciden con
palabras comunes del ingles y el panel del simbolo terminaba mostrando basura
("SpaceX Open IPO" para OPEN). Reglas:

- Las consultas por simbolo se construyen con la METADATA de C010 (nombre de
  la empresa primero, ticker despues) — nunca solo el ticker crudo.
- Cada item recibe un score de relevancia (titulo+resumen+URL+relatedTickers)
  con filtros de falsos positivos; solo lo que pasa el umbral se muestra y se
  vincula en C061. Tickers ambiguos exigen un umbral MAS alto.
- Las noticias globales pueden ser amplias, pero se rankean por frescura +
  calidad de la fuente + keywords de impacto de mercado.
"""
from __future__ import annotations

import re
from datetime import datetime

# ===== Umbrales =====
RELEVANCE_THRESHOLD_NORMAL = 40
RELEVANCE_THRESHOLD_AMBIGUOUS = 70

# Tickers que son palabras/acronimos comunes en ingles: jamas aceptar la
# palabra suelta como coincidencia.
AMBIGUOUS_TICKERS = {
    "OPEN", "AI", "ON", "NOW", "SHOP", "FOR", "ARE", "ALL", "BY", "IT",
    "OR", "BE", "SO", "GO", "LIFE", "REAL", "PLAY", "LOVE", "BILL",
    "DOCS", "TEAM", "DASH", "NET", "ANY", "BIG", "CAR", "CASH", "COST",
    "DAY", "EAT", "EVER", "FAST", "FIVE", "FLOW", "FUN", "GOOD", "HAS",
    "HEAR", "HOPE", "JOB", "KEY", "LAND", "LOW", "MAIN", "MIND", "NICE",
    "ONE", "OUT", "PAY", "PEAK", "PLAN", "RACE", "RIDE", "ROOT", "RUN",
    "SAFE", "SEE", "SELF", "SKY", "STEP", "SUN", "TALK", "TWO", "WELL", "YOU",
}

# Frases de falso positivo POR TICKER (se omiten si aparece un alias real de
# la empresa: "open IPO" es valido si tambien menciona Opendoor).
FALSE_POSITIVE_PHRASES: dict[str, list[str]] = {
    "OPEN": [
        "spacex open", "open ipo", "openai", "market open", "markets open",
        "stores open", "open source", "open letter", "open interest",
        "open enrollment", "open house", "open banking", "grand open",
    ],
    "AI": ["openai", "generative ai boom", "ai arms race"],
    "ON": [],
    "NOW": ["for now", "right now", "now hiring"],
}

# Sufijos legales que se quitan para generar alias del nombre de empresa.
_LEGAL_SUFFIXES = (
    "inc.", "inc", "corp.", "corp", "corporation", "ltd.", "ltd", "plc",
    "s.a.", "co.", "co", "company", "holdings", "group", "n.v.", "ag", "se",
)

# Primeras palabras demasiado genericas para usarse como alias por si solas.
_GENERIC_FIRST_WORDS = {
    "the", "first", "global", "american", "united", "national", "general",
    "international", "new", "digital", "world",
}


def _norm(text: str) -> str:
    """MAYUSCULAS, sin puntuacion y espacios colapsados (para que
    '(AAPL) stock' o 'C3.ai' casen como 'AAPL STOCK' / 'C3 AI')."""
    cleaned = re.sub(r"[^A-Z0-9&\s]", " ", (text or "").upper())
    return re.sub(r"\s+", " ", cleaned).strip()


def is_ambiguous_ticker(ticker: str) -> bool:
    return (ticker or "").strip().upper() in AMBIGUOUS_TICKERS


def relevance_threshold(instrument) -> int:
    return (
        RELEVANCE_THRESHOLD_AMBIGUOUS
        if is_ambiguous_ticker(instrument.Ticker)
        else RELEVANCE_THRESHOLD_NORMAL
    )


def company_aliases(instrument) -> list[str]:
    """Alias del nombre de empresa, del mas especifico al mas corto.

    'Opendoor Technologies Inc.' -> ['Opendoor Technologies Inc.',
    'Opendoor Technologies', 'Opendoor']; 'C3.ai' -> ['C3.ai'].
    """
    name = (instrument.NombreInstrumento or "").strip()
    if not name:
        return []
    aliases = [name]
    # Sin sufijo legal.
    words = name.split()
    while words and words[-1].lower().strip(",") in _LEGAL_SUFFIXES:
        words = words[:-1]
    stripped = " ".join(words)
    if stripped and stripped not in aliases:
        aliases.append(stripped)
    # Primera palabra como alias de marca (Opendoor, Shopify, Teladoc...).
    first = words[0] if words else ""
    if (
        len(first) >= 5
        and first.lower() not in _GENERIC_FIRST_WORDS
        and first not in aliases
    ):
        aliases.append(first)
    return aliases


def _alias_in_text(alias: str, raw_text: str, norm_text: str, ticker: str) -> bool:
    """Busca el alias. Si el alias EMPIEZA con el propio ticker ambiguo como
    palabra ('ON Semiconductor'), la busqueda es case-sensitive para no
    confundir 'tariffs on semiconductors' con la empresa."""
    upper_alias = alias.upper()
    if is_ambiguous_ticker(ticker) and (
        upper_alias == ticker or upper_alias.startswith(ticker + " ")
    ):
        return alias in (raw_text or "")
    return _norm(alias) in norm_text


# ===== Constructor de consultas por simbolo (metadata de C010) =====


def build_symbol_news_queries(instrument) -> list[str]:
    """Consultas company-aware para el panel del simbolo (nombre primero,
    ticker despues). Jamas genera la palabra suelta para tickers ambiguos."""
    ticker = (instrument.Ticker or "").strip().upper()
    name = (instrument.NombreInstrumento or "").strip()
    exchange = (instrument.Exchange or "").strip()
    tipo = (instrument.TipoInstrumento or "").strip().upper()

    queries: list[str] = []
    if tipo == "ETF":
        if name:
            queries = [f"{name} ETF", f"{ticker} ETF news", f"{name} fund flows"]
        else:
            queries = [f"{ticker} ETF news", f"{ticker} ETF"]
    elif name:
        queries = [
            f"{name} stock news",
            f"{ticker} stock {name}",
            f"{name} earnings",
            f"{name} shares",
        ]
        if exchange:
            queries.append(f"{exchange} {ticker} {name}")
    else:
        # Sin nombre en C010: consultas con contexto bursatil explicito
        # (los filtros estrictos hacen el resto).
        queries = [
            f"{ticker} stock news",
            f"{ticker} shares",
            f"{ticker} earnings",
        ]
    return queries


# ===== Score de relevancia por simbolo =====


def score_symbol_news_relevance(
    item, instrument, provider_linked: bool | None = None
) -> tuple[int, str]:
    """Score de relevancia de una noticia para el instrumento activo.

    item: NewsItem (o cualquier objeto con title/summary/url/relatedTickers/
    provider). Devuelve (score, razon legible). provider_linked fuerza el
    bono de "el proveedor ya la vincula al ticker" (None => se infiere de
    relatedTickers).
    """
    ticker = (instrument.Ticker or "").strip().upper()
    yahoo_symbol = (getattr(instrument, "YahooSymbol", "") or "").strip().upper()
    raw_text = f"{getattr(item, 'title', '') or ''} {getattr(item, 'summary', '') or ''}"
    norm_text = _norm(raw_text)
    lower_text = raw_text.lower()
    url = (getattr(item, "url", "") or "").lower()
    ambiguous = is_ambiguous_ticker(ticker)

    score = 0
    reasons: list[str] = []

    # --- Alias de empresa (titulo > resumen; no se apilan) ---
    aliases = company_aliases(instrument)
    raw_title = getattr(item, "title", "") or ""
    norm_title = _norm(raw_title)
    alias_in_title = any(
        _alias_in_text(a, raw_title, norm_title, ticker) for a in aliases
    )
    alias_anywhere = alias_in_title or any(
        _alias_in_text(a, raw_text, norm_text, ticker) for a in aliases
    )
    if alias_in_title:
        score += 80
        reasons.append(f"nombre de empresa en titulo ({aliases[0]})")
    elif alias_anywhere:
        score += 60
        reasons.append(f"nombre de empresa en resumen ({aliases[0]})")

    # --- Falsos positivos por ticker (se omiten si hay alias real) ---
    if not alias_anywhere:
        for phrase in FALSE_POSITIVE_PHRASES.get(ticker, []):
            if phrase in lower_text:
                score -= 100
                reasons.append(f"falso positivo: '{phrase}'")
                break

    # --- El proveedor ya la vincula al ticker (Yahoo symbol/trending) ---
    if provider_linked is None:
        related = {t.strip().upper() for t in getattr(item, "relatedTickers", [])}
        provider_linked = bool(related & {ticker, yahoo_symbol})
    if provider_linked:
        score += 100
        reasons.append("vinculada al ticker por el proveedor")

    # --- Contexto bursatil explicito del ticker ---
    ticker_re = re.escape(ticker)
    has_stock_ctx = bool(
        re.search(rf"\b{ticker_re} (STOCK|SHARES|SHARE)\b", norm_text)
    )
    has_exchange_ctx = bool(
        re.search(rf"\b(NYSE|NASDAQ|AMEX) {ticker_re}\b", norm_text)
    )
    has_earnings_ctx = bool(re.search(rf"\b{ticker_re} EARNINGS\b", norm_title))
    if has_stock_ctx:
        score += 50
        reasons.append(f"contexto '{ticker} stock/shares'")
    if has_exchange_ctx:
        score += 50
        reasons.append(f"contexto 'NYSE/NASDAQ: {ticker}'")
    if has_earnings_ctx:
        score += 40
        reasons.append(f"contexto '{ticker} earnings'")

    # Ticker EXACTO en mayusculas en el titulo crudo (OPEN si, "open" no).
    ticker_as_token = bool(re.search(rf"\b{ticker_re}\b", raw_title))
    if ticker_as_token and (has_stock_ctx or has_exchange_ctx or has_earnings_ctx):
        score += 30
        reasons.append("ticker en mayusculas en el titulo")

    # --- URL con slug de la empresa ---
    slug = aliases[-1].lower() if aliases else ""
    if len(slug) >= 5 and (
        slug.replace(" ", "-") in url or slug.replace(" ", "") in url
    ):
        score += 30
        reasons.append("URL contiene el nombre de la empresa")

    # --- Sector/industria como contexto debil ---
    for phrase in ((instrument.Sector or ""), (getattr(instrument, "Industria", "") or "")):
        phrase = phrase.strip().lower()
        if len(phrase) >= 4 and phrase in lower_text:
            score += 20
            reasons.append(f"contexto de sector/industria ({phrase})")
            break

    # --- Penalizacion: ticker ambiguo sin alias ni contexto bursatil ---
    if ambiguous and not alias_anywhere and not (
        has_stock_ctx or has_exchange_ctx or has_earnings_ctx
    ):
        score -= 80
        reasons.append(
            f"'{ticker}' aparece solo como palabra comun (sin empresa ni contexto bursatil)"
        )

    return score, "; ".join(reasons) if reasons else "sin señales de relevancia"


# ===== Ranking de noticias globales =====

QUALITY_PUBLISHERS = (
    "yahoo finance", "reuters", "bloomberg", "cnbc", "marketwatch",
    "barron", "wsj", "wall street journal", "associated press", "ap news",
    "financial times", "investor's business daily", "the economist",
)

MARKET_IMPACT_KEYWORDS = (
    "stocks", "shares", "market", "nasdaq", "s&p 500", "dow", "futures",
    "treasury yield", "fed", "inflation", "tariff", "earnings", "oil",
    "chips", " ai ", "semiconductor", "rate cut", "rate hike",
)

_HIGH_IMPACT_CATEGORIES = {
    "Top Trending Stocks Today", "Geopolitics / Policy", "Fed / Rates",
    "Market sentiment", "Earnings", "Inflation",
}


def global_rank_score(
    title: str,
    summary: str | None,
    publisher: str | None,
    category: str | None,
    published_at: datetime | None,
    now: datetime,
) -> float:
    """Frescura primero; despues calidad de fuente, impacto y categoria."""
    if published_at is not None:
        age_hours = max((now - published_at).total_seconds() / 3600.0, 0.0)
        score = max(0.0, 72.0 - age_hours)
    else:
        score = 0.0
    pub = (publisher or "").lower()
    if any(q in pub for q in QUALITY_PUBLISHERS):
        score += 6.0
    text = f" {title} {summary or ''} ".lower()
    hits = sum(1 for k in MARKET_IMPACT_KEYWORDS if k in text)
    score += min(hits * 2.0, 8.0)
    if category in _HIGH_IMPACT_CATEGORIES:
        score += 2.0
    return score
