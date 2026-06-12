"""Proveedor Google News via feeds RSS publicos (best-effort, solo backend).

Sin API key: usa news.google.com/rss/search con GRUPOS de consultas
(mercado global, geopolitica/politica, Fed/macro, tech/IA y trending
stocks). El numero de consultas por refresh y los items por consulta estan
acotados por configuracion para no saturar al proveedor.
"""
from __future__ import annotations

import logging
from urllib.parse import quote

from app.config import env_settings
from app.services.news.news_provider_base import NewsProviderBase
from app.services.news.news_types import NewsItem, classify_category
from app.services.news.rss_utils import fetch_rss_entries

logger = logging.getLogger("google_news_provider")

GLOBAL_MARKET_QUERIES = [
    "stock market today",
    "stock market news today",
    "Wall Street today",
    "S&P 500 Nasdaq Dow today",
    "market futures today",
    "market rally selloff today",
    "stocks rise fall today",
    "Yahoo Finance latest market news",
    "CNBC stock market today",
    "Reuters markets today",
    "Bloomberg markets today",
]

GEOPOLITICAL_MARKET_QUERIES = [
    "Trump tariffs stock market",
    "Trump trade deal stocks",
    "White House stock market policy",
    "US China trade stock market",
    "tariff news stocks today",
    "sanctions stock market impact",
    "geopolitical risk stocks",
    "government shutdown stock market",
    "election market impact",
    "regulation stocks today",
    "antitrust stocks market",
    "SEC regulation stock market",
]

FED_MACRO_QUERIES = [
    "Federal Reserve stocks today",
    "Fed rate cuts market",
    "Powell speech stocks",
    "Treasury yields Nasdaq",
    "inflation CPI stock market",
    "jobs report stocks",
    "unemployment report markets",
    "GDP report stocks",
    "bond yields stock market",
]

SECTOR_QUERIES = [
    "technology stocks news today",
    "AI stocks news today",
    "semiconductor stocks news today",
    "energy stocks oil prices today",
    "bank stocks news today",
    "healthcare stocks news today",
    "retail stocks news today",
    "housing stocks mortgage rates",
]

# Alias retro-compatible (grupo tech/IA absorbido por SECTOR_QUERIES).
TECH_AI_QUERIES = SECTOR_QUERIES[:3]

TRENDING_STOCKS_QUERIES = [
    "top trending stocks today",
    "stocks moving today",
    "biggest stock movers today",
    "premarket movers today",
    "after hours movers today",
    "top gainers stock news today",
    "top losers stock news today",
    "most active stocks news today",
    "stocks to watch today",
]


def _interleave(*groups: list[str]) -> list[str]:
    """Intercala los grupos (round-robin) para que el limite de consultas por
    refresh cubra TODOS los temas, no solo el primer grupo."""
    out: list[str] = []
    for i in range(max(len(g) for g in groups) if groups else 0):
        for group in groups:
            if i < len(group):
                out.append(group[i])
    return out


class GoogleNewsProvider(NewsProviderBase):
    name = "GOOGLE_NEWS"

    def _fetch_query(self, query: str, limit: int) -> list[NewsItem]:
        if not env_settings.ENABLE_GOOGLE_NEWS_PROVIDER:
            return []
        lang = env_settings.GOOGLE_NEWS_LANGUAGE
        region = env_settings.GOOGLE_NEWS_REGION
        url = (
            "https://news.google.com/rss/search?q=" + quote(query)
            + f"&hl={lang}-{region}&gl={region}&ceid={region}:{lang}"
        )
        entries = fetch_rss_entries(
            url, env_settings.GOOGLE_NEWS_TIMEOUT_SECONDS, limit
        )
        if env_settings.NEWS_DEBUG:
            logger.info("Google query '%s' -> %d items", query[:50], len(entries))
        return [
            NewsItem(
                title=e.title,
                url=e.link,
                provider=self.name,
                externalId=e.guid,
                publisher=e.publisher,
                publishedAt=e.publishedAt,
                category=classify_category(e.title, e.description),
                language=lang,
                country=region,
            )
            for e in entries
        ]

    def _fetch_query_group(self, queries: list[str], limit: int) -> list[NewsItem]:
        per_query = env_settings.NEWS_GLOBAL_QUERY_LIMIT_PER_QUERY
        max_queries = env_settings.NEWS_GLOBAL_MAX_QUERIES_PER_REFRESH
        items: list[NewsItem] = []
        seen_urls: set[str] = set()
        for query in queries[:max_queries]:
            for item in self._fetch_query(query, per_query):
                if item.url in seen_urls:
                    continue  # dedupe agresivo entre consultas del grupo
                seen_urls.add(item.url)
                items.append(item)
            if len(items) >= limit:
                break
        return items[:limit]

    def get_global_market_news(
        self, category: str | None = None, limit: int = 50
    ) -> list[NewsItem]:
        if category and category not in ("All", "Other"):
            return self._fetch_query(f"{category} stock market news", limit)
        # Intercalado: con el limite de consultas activo igual se cubren
        # mercado + macro/Fed + sectores (no solo el primer grupo).
        return self._fetch_query_group(
            _interleave(GLOBAL_MARKET_QUERIES, FED_MACRO_QUERIES, SECTOR_QUERIES),
            limit,
        )

    def get_global_geopolitical_market_news(self, limit: int = 50) -> list[NewsItem]:
        """Politica/geopolitica que mueve mercados (Trump, tarifas, deals...)."""
        return self._fetch_query_group(GEOPOLITICAL_MARKET_QUERIES, limit)

    def get_top_trending_stock_news(self, limit: int = 50) -> list[NewsItem]:
        """Noticias de acciones en movimiento hoy y sus catalizadores."""
        return self._fetch_query_group(TRENDING_STOCKS_QUERIES, limit)

    def get_symbol_news(self, symbol: str, limit: int = 30) -> list[NewsItem]:
        """Fallback sin metadata: contexto bursatil explicito en la consulta.

        NO auto-etiqueta relatedTickers: Google solo busca texto, asi que la
        relevancia la decide el score del orquestador (a diferencia de Yahoo,
        cuyos feeds por simbolo SI estan vinculados al ticker)."""
        return self._fetch_query(f"{symbol.upper()} stock news", limit)

    def get_symbol_news_for_instrument(
        self, instrument, queries: list[str], limit: int = 30
    ) -> list[NewsItem]:
        """Consultas company-aware (nombre de C010 primero, ticker despues).

        Cada resultado debe pasar el score de relevancia del orquestador:
        aqui no se etiqueta nada como relacionado."""
        items: list[NewsItem] = []
        seen_urls: set[str] = set()
        per_query = env_settings.NEWS_GLOBAL_QUERY_LIMIT_PER_QUERY
        for query in queries:
            for item in self._fetch_query(query, per_query):
                if item.url in seen_urls:
                    continue
                seen_urls.add(item.url)
                items.append(item)
            if len(items) >= limit:
                break
        return items[:limit]
