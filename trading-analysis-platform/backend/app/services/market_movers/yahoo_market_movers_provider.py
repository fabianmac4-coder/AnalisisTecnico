"""Proveedor Yahoo de market movers (best-effort y aislado).

- TOP_GAINERS / TOP_LOSERS / MOST_ACTIVE: screeners predefinidos de yfinance
  (yf.screen). Si la version instalada no los soporta o Yahoo cambia el
  formato, devuelve [] sin romper.
- TRENDING: endpoint publico de trending de Yahoo via httpx (mismos hosts que
  usa yfinance); los simbolos se devuelven sin precio (la UI lo tolera) salvo
  el enriquecimiento ligero con el cache de cotizaciones existente.
"""
from __future__ import annotations

import logging

import httpx

from app.services.market_movers.market_movers_provider_base import (
    MarketMoversProviderBase,
)
from app.services.market_movers.market_movers_types import (
    LIST_MOST_ACTIVE,
    LIST_TOP_GAINERS,
    LIST_TOP_LOSERS,
    LIST_TRENDING,
    MarketMoverItem,
)

logger = logging.getLogger("yahoo_movers_provider")

_SCREENER_BY_LIST = {
    LIST_TOP_GAINERS: "day_gainers",
    LIST_TOP_LOSERS: "day_losers",
    LIST_MOST_ACTIVE: "most_actives",
}

_TRENDING_URL = "https://query1.finance.yahoo.com/v1/finance/trending/US"


def _safe_float(value) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _quote_to_item(quote: dict, source: str) -> MarketMoverItem | None:
    symbol = quote.get("symbol")
    if not symbol:
        return None
    return MarketMoverItem(
        symbol=str(symbol).upper(),
        source=source,
        name=quote.get("shortName") or quote.get("longName"),
        price=_safe_float(quote.get("regularMarketPrice")),
        change=_safe_float(quote.get("regularMarketChange")),
        changePercent=_safe_float(quote.get("regularMarketChangePercent")),
        volume=_safe_float(quote.get("regularMarketVolume")),
        marketCap=_safe_float(quote.get("marketCap")),
    )


class YahooMarketMoversProvider(MarketMoversProviderBase):
    name = "YAHOO"

    def _screener(self, screener_id: str, limit: int) -> list[MarketMoverItem]:
        try:
            import yfinance as yf

            data = yf.screen(screener_id, count=limit)
            quotes = (data or {}).get("quotes", [])
        except Exception as exc:  # noqa: BLE001 - best-effort
            logger.warning("Screener %s fallo: %s", screener_id, type(exc).__name__)
            return []
        items = []
        for quote in quotes[:limit]:
            item = _quote_to_item(quote, self.name)
            if item is not None:
                items.append(item)
        return items

    def _trending(self, limit: int) -> list[MarketMoverItem]:
        try:
            response = httpx.get(
                _TRENDING_URL,
                timeout=10,
                headers={"User-Agent": "Mozilla/5.0 (personal trading dashboard)"},
            )
            response.raise_for_status()
            results = response.json().get("finance", {}).get("result", [])
            raw_quotes = results[0].get("quotes", []) if results else []
        except Exception as exc:  # noqa: BLE001 - best-effort
            logger.warning("Trending fallo: %s", type(exc).__name__)
            return []

        items: list[MarketMoverItem] = []
        for quote in raw_quotes[:limit]:
            symbol = quote.get("symbol")
            if not symbol:
                continue
            items.append(MarketMoverItem(symbol=str(symbol).upper(), source=self.name))

        # Enriquecimiento ligero: precio canonico (cacheado 30s) de los 10
        # primeros; si falla alguno, queda sin precio (la UI lo tolera).
        from app.services import yahoo_service

        for item in items[:10]:
            try:
                quote = yahoo_service.get_quote(item.symbol)
                item.price = quote.price
                item.change = quote.change
                item.changePercent = quote.changePercent
            except Exception:  # noqa: BLE001
                continue
        return items

    def get_list(self, list_type: str, limit: int = 25) -> list[MarketMoverItem]:
        if list_type == LIST_TRENDING:
            return self._trending(limit)
        screener_id = _SCREENER_BY_LIST.get(list_type)
        if screener_id is None:
            return []
        return self._screener(screener_id, limit)
