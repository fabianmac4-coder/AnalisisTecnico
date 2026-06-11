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
    "S&P 500 Nasdaq Dow market news today",
    "Wall Street stocks today",
    "earnings stocks market today",
    "bond yields stock market today",
]

GEOPOLITICAL_MARKET_QUERIES = [
    "Trump tariffs stock market",
    "Trump trade deal stocks",
    "White House stock market policy",
    "US China trade stocks",
    "China Taiwan stocks market",
    "Russia Ukraine stocks market",
    "Middle East conflict oil stocks",
    "sanctions stock market impact",
    "government shutdown stock market",
    "geopolitical risk stock market",
]

FED_MACRO_QUERIES = [
    "Federal Reserve interest rates stocks",
    "inflation CPI stock market",
    "jobs report stock market",
]

TECH_AI_QUERIES = [
    "AI stocks market news",
    "semiconductor stocks news",
]

TRENDING_STOCKS_QUERIES = [
    "top trending stocks today",
    "stocks moving today",
    "premarket movers today",
    "biggest stock movers today",
    "most active stocks today news",
    "why stocks are moving today",
    "stocks to watch today",
]


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
        for query in queries[:max_queries]:
            items.extend(self._fetch_query(query, per_query))
            if len(items) >= limit:
                break
        return items[:limit]

    def get_global_market_news(
        self, category: str | None = None, limit: int = 50
    ) -> list[NewsItem]:
        if category and category not in ("All", "Other"):
            return self._fetch_query(f"{category} stock market news", limit)
        return self._fetch_query_group(
            [*GLOBAL_MARKET_QUERIES, *FED_MACRO_QUERIES, *TECH_AI_QUERIES], limit
        )

    def get_global_geopolitical_market_news(self, limit: int = 50) -> list[NewsItem]:
        """Politica/geopolitica que mueve mercados (Trump, tarifas, deals...)."""
        return self._fetch_query_group(GEOPOLITICAL_MARKET_QUERIES, limit)

    def get_top_trending_stock_news(self, limit: int = 50) -> list[NewsItem]:
        """Noticias de acciones en movimiento hoy y sus catalizadores."""
        return self._fetch_query_group(TRENDING_STOCKS_QUERIES, limit)

    def get_symbol_news(self, symbol: str, limit: int = 30) -> list[NewsItem]:
        symbol = symbol.upper()
        items = self._fetch_query(f"{symbol} stock", limit)
        for item in items:
            item.relatedTickers = [symbol]
        return items
