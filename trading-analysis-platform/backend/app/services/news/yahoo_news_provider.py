"""Proveedor Yahoo Finance: noticias por ticker (yfinance) + feeds RSS
publicos de Yahoo Finance para latest/top/trending stocks.

Best-effort y aislado: si Yahoo cambia formato o falla, devuelve [] sin
romper la pagina de noticias. Etiquetas de proveedor:
YAHOO_FINANCE_SYMBOL / YAHOO_FINANCE_LATEST / YAHOO_FINANCE_TOP /
YAHOO_FINANCE_TRENDING_STOCKS.
"""
from __future__ import annotations

import logging
from datetime import datetime

from app.config import env_settings
from app.services import news_service as legacy_news
from app.services.news.news_provider_base import NewsProviderBase
from app.services.news.news_types import NewsItem, classify_category
from app.services.news.rss_utils import fetch_rss_entries

logger = logging.getLogger("yahoo_news_provider")

# Feed general de noticias de Yahoo Finance (portada/latest).
_YAHOO_RSS_INDEX = "https://finance.yahoo.com/news/rssindex"
# Feed de titulares por simbolo (tambien sirve para indices: ^GSPC, ^IXIC).
_YAHOO_HEADLINE_RSS = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbols}"


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(
            tzinfo=None
        )
    except ValueError:
        return None


class YahooNewsProvider(NewsProviderBase):
    name = "YAHOO_FINANCE_SYMBOL"

    def _rss_items(
        self, url: str, provider_label: str, limit: int, tickers: list[str] | None = None
    ) -> list[NewsItem]:
        if not env_settings.ENABLE_YAHOO_NEWS_PROVIDER:
            return []
        entries = fetch_rss_entries(
            url, env_settings.GOOGLE_NEWS_TIMEOUT_SECONDS, limit
        )
        items: list[NewsItem] = []
        for e in entries:
            items.append(
                NewsItem(
                    title=e.title,
                    url=e.link,
                    provider=provider_label,
                    externalId=e.guid,
                    publisher=e.publisher or "Yahoo Finance",
                    publishedAt=e.publishedAt,
                    relatedTickers=list(tickers or []),
                    category=classify_category(e.title, e.description),
                    language="en",
                    country="US",
                )
            )
        return items

    def get_yahoo_latest_news(self, limit: int = 50) -> list[NewsItem]:
        """Portada/ultimas noticias de Yahoo Finance (RSS publico)."""
        return self._rss_items(_YAHOO_RSS_INDEX, "YAHOO_FINANCE_LATEST", limit)

    def get_yahoo_top_market_news(self, limit: int = 50) -> list[NewsItem]:
        """Top stories de mercado: titulares de los indices principales."""
        url = _YAHOO_HEADLINE_RSS.format(symbols="^GSPC,^IXIC,^DJI")
        return self._rss_items(url, "YAHOO_FINANCE_TOP", limit)

    def get_yahoo_trending_stock_news(
        self, tickers: list[str], per_ticker: int = 3, limit: int = 50
    ) -> list[NewsItem]:
        """Titulares de los tickers en movimiento hoy (acotado por config)."""
        items: list[NewsItem] = []
        for ticker in tickers[: env_settings.NEWS_TRENDING_STOCKS_MAX_TICKERS]:
            url = _YAHOO_HEADLINE_RSS.format(symbols=ticker)
            got = self._rss_items(
                url, "YAHOO_FINANCE_TRENDING_STOCKS", per_ticker, tickers=[ticker]
            )
            items.extend(got)
            if len(items) >= limit:
                break
        return items[:limit]

    def get_global_market_news(
        self, category: str | None = None, limit: int = 50
    ) -> list[NewsItem]:
        # Lo global de Yahoo se agrega via latest/top en el orquestador.
        return []

    def get_symbol_news(self, symbol: str, limit: int = 30) -> list[NewsItem]:
        try:
            raw_items = legacy_news.get_symbol_news(symbol, limit=limit)
        except Exception as exc:  # noqa: BLE001 - best-effort
            logger.warning("Yahoo news fallo para %s: %s", symbol, type(exc).__name__)
            return []
        items: list[NewsItem] = []
        for raw in raw_items:
            if not raw.get("url"):
                continue
            title = raw["title"]
            summary = raw.get("summary")
            items.append(
                NewsItem(
                    title=title,
                    url=raw["url"],
                    provider=self.name,
                    summary=summary,
                    publisher=raw.get("publisher"),
                    publishedAt=_parse_dt(raw.get("publishedAt")),
                    relatedTickers=[symbol.upper()],
                    category=classify_category(title, summary),
                    language="en",
                    country="US",
                )
            )
        return items
