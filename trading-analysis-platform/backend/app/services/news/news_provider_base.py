"""Interfaz comun de proveedores de noticias.

Para agregar un proveedor futuro (NewsAPI, GNews, Finnhub, etc.) basta con
implementar esta interfaz y registrarlo en news_service._providers().
Los proveedores son BEST-EFFORT: jamas lanzan al caller; devuelven [].
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.services.news.news_types import NewsItem


class NewsProviderBase(ABC):
    name: str = "BASE"

    @abstractmethod
    def get_global_market_news(
        self, category: str | None = None, limit: int = 50
    ) -> list[NewsItem]:
        """Noticias globales de mercado/geopolitica. [] si falla."""

    @abstractmethod
    def get_symbol_news(self, symbol: str, limit: int = 30) -> list[NewsItem]:
        """Noticias del ticker. [] si falla."""
