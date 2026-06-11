"""Tipos comunes de noticias + clasificador de categorias por reglas."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class NewsItem:
    title: str
    url: str
    provider: str
    externalId: str | None = None
    summary: str | None = None
    publisher: str | None = None
    publishedAt: datetime | None = None
    imageUrl: str | None = None
    relatedTickers: list[str] = field(default_factory=list)
    category: str | None = None
    language: str | None = None
    country: str | None = None
    raw: dict | None = None


CATEGORY_ALL = "All"
CATEGORY_TRENDING = "Top Trending Stocks Today"
CATEGORY_GEOPOLITICS = "Geopolitics / Policy"
CATEGORIES = [
    CATEGORY_TRENDING,
    CATEGORY_GEOPOLITICS,
    "Macro",
    "Fed / Rates",
    "Inflation",
    "Earnings",
    "Technology",
    "AI",
    "Semiconductors",
    "Energy",
    "Market sentiment",
    "Other",
]

# Slugs de la API -> nombre de categoria (el endpoint acepta ambos).
CATEGORY_SLUGS = {
    "top_trending_stocks_today": CATEGORY_TRENDING,
    "geopolitics_policy": CATEGORY_GEOPOLITICS,
    "macro": "Macro",
    "fed_rates": "Fed / Rates",
    "inflation": "Inflation",
    "earnings": "Earnings",
    "technology": "Technology",
    "ai": "AI",
    "semiconductors": "Semiconductors",
    "energy": "Energy",
    "market_sentiment": "Market sentiment",
    "other": "Other",
}

# Orden de evaluacion: lo mas especifico primero.
_RULES: list[tuple[str, list[str]]] = [
    (
        CATEGORY_TRENDING,
        [
            "trending stocks", "stocks moving", "stock movers", "biggest movers",
            "top gainers", "top losers", "most active", "premarket movers",
            "pre-market movers", "after-hours movers", "after hours movers",
            "shares rise", "shares fall", "shares jump", "shares drop",
            "stock jumps", "stock drops", "stock rallies", "stock sinks",
            "stock surges", "stock slides", "stock soars", "stock plunges",
            "why stock is moving", "stocks to watch", "movers today",
        ],
    ),
    (
        "Semiconductors",
        ["semiconductor", "chipmaker", "nvidia", "amd", "tsmc", "asml", "intel", "foundry"],
    ),
    (
        "AI",
        ["artificial intelligence", " ai ", "openai", "chatgpt", "data center", "machine learning"],
    ),
    (
        "Fed / Rates",
        [
            "federal reserve", " fed ", "powell", "interest rate", "rate cut",
            "rate hike", "fomc", "treasury yield",
        ],
    ),
    ("Inflation", ["inflation", " cpi", " ppi", "consumer price", "producer price"]),
    (
        CATEGORY_GEOPOLITICS,
        [
            # Politica/policy que mueve mercados (no solo guerra).
            "trump", "white house", "biden", "administration", "president",
            "congress", "senate", "the house", "election", "tariff",
            "trade deal", "trade war", "trade policy", "us-china", "china",
            "taiwan", "russia", "ukraine", "middle east", "israel", "iran",
            "sanction", "export control", "government shutdown", "debt ceiling",
            "regulation", "antitrust", "ftc", "doj", "sec ", "geopolit",
            "war", "conflict", "defense", "nato", "immigration policy",
            "tax bill", "fiscal policy",
        ],
    ),
    ("Earnings", ["earnings", "quarterly results", "guidance", "revenue beat", "profit report"]),
    ("Energy", [" oil", "crude", "natural gas", "opec", "energy prices", "barrel"]),
    ("Technology", ["technology", "software", "cloud", "cybersecurity", "tech stocks", "big tech"]),
    (
        "Market sentiment",
        [
            "s&p 500", "nasdaq", "dow", "stocks", "futures", "rally",
            "selloff", "sell-off", "wall street", "market",
        ],
    ),
    ("Macro", ["gdp", "employment", "jobs report", "unemployment", "recession", "economy", "macro"]),
]


def classify_category(title: str, summary: str | None = None) -> str:
    """Clasificacion por palabras clave, case-insensitive (sin IA)."""
    text = f" {title} {summary or ''} ".lower()
    for category, keywords in _RULES:
        if any(k in text for k in keywords):
            return category
    return "Other"


def resolve_category(value: str | None) -> str | None:
    """Acepta slug de API ('geopolitics_policy') o nombre legible."""
    if not value or value.lower() in ("all", "yahoo_latest"):
        return None
    return CATEGORY_SLUGS.get(value.lower(), value)
