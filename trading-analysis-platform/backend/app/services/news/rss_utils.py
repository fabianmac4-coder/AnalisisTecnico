"""Helper compartido para leer feeds RSS (Google News y Yahoo Finance).

Best-effort: cualquier fallo de red/parseo devuelve [] con warning en el log.
httpx respeta SSL_CERT_FILE (configurado por app/ca_bundle.py para redes con
proxy TLS). Parse con xml.etree (stdlib, sin dependencias nuevas).
"""
from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime

import httpx

logger = logging.getLogger("rss_utils")

_UA = {"User-Agent": "Mozilla/5.0 (personal trading dashboard)"}


@dataclass
class RssEntry:
    title: str
    link: str
    publisher: str | None
    publishedAt: datetime | None
    guid: str | None
    description: str | None


def parse_pubdate(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)
        return dt.replace(tzinfo=None) if dt.tzinfo else dt
    except (TypeError, ValueError):
        return None


def fetch_rss_entries(url: str, timeout: float, limit: int) -> list[RssEntry]:
    """Items normalizados de un feed RSS; [] si el feed falla o cambia."""
    try:
        response = httpx.get(url, timeout=timeout, follow_redirects=True, headers=_UA)
        response.raise_for_status()
        root = ET.fromstring(response.text)
    except Exception as exc:  # noqa: BLE001 - best-effort
        logger.warning("RSS fallo (%s...): %s", url[:60], type(exc).__name__)
        return []

    entries: list[RssEntry] = []
    for node in root.iter("item"):
        title = (node.findtext("title") or "").strip()
        link = (node.findtext("link") or "").strip()
        if not title or not link:
            continue
        source = node.findtext("source")
        publisher = source.strip() if source else None
        if publisher is None and " - " in title:
            title, publisher = title.rsplit(" - ", 1)
            title = title.strip()
            publisher = publisher.strip()
        entries.append(
            RssEntry(
                title=title,
                link=link,
                publisher=publisher,
                publishedAt=parse_pubdate(node.findtext("pubDate")),
                guid=(node.findtext("guid") or "").strip() or None,
                description=node.findtext("description"),
            )
        )
        if len(entries) >= limit:
            break
    return entries
