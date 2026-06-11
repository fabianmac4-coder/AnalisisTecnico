"""Noticias por simbolo, best-effort via yfinance.

Si yfinance no devuelve noticias (o falla), se devuelve lista vacia: el chat
NUNCA debe romperse por noticias, y el contexto marca news_available=false
para que el modelo no invente noticias.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, TypedDict

logger = logging.getLogger("news_service")


class NewsItem(TypedDict):
    title: str
    publisher: str | None
    publishedAt: str | None
    url: str | None
    summary: str | None


def _to_iso(value: Any) -> str | None:
    """Normaliza fechas de yfinance (epoch o ISO) a ISO-8601 UTC."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            return None
    return str(value)


def _normalize_item(raw: dict) -> NewsItem | None:
    """Soporta el formato viejo (plano) y el nuevo (content anidado) de yfinance."""
    content = raw.get("content") if isinstance(raw.get("content"), dict) else raw
    title = content.get("title") or raw.get("title")
    if not title:
        return None

    url = None
    canonical = content.get("canonicalUrl")
    if isinstance(canonical, dict):
        url = canonical.get("url")
    url = url or raw.get("link") or content.get("link")

    publisher = None
    provider = content.get("provider")
    if isinstance(provider, dict):
        publisher = provider.get("displayName")
    publisher = publisher or raw.get("publisher")

    published = content.get("pubDate") or raw.get("providerPublishTime")

    return NewsItem(
        title=str(title),
        publisher=str(publisher) if publisher else None,
        publishedAt=_to_iso(published),
        url=str(url) if url else None,
        summary=str(content.get("summary")) if content.get("summary") else None,
    )


def get_symbol_news(symbol: str, limit: int = 5) -> list[NewsItem]:
    """Noticias recientes del simbolo; [] si no hay o si yfinance falla."""
    try:
        import yfinance as yf

        raw_items = yf.Ticker(symbol).news or []
    except Exception as exc:  # noqa: BLE001 - noticias jamas rompen el chat
        logger.warning("No se pudieron obtener noticias de %s: %s", symbol, type(exc).__name__)
        return []

    items: list[NewsItem] = []
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        normalized = _normalize_item(raw)
        if normalized is not None:
            items.append(normalized)
        if len(items) >= limit:
            break
    return items
