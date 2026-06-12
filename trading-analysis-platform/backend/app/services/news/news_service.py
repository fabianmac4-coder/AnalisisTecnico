"""Orquestador de noticias: providers -> cache SQL (C060/C061) -> API.

Reglas de frescura:
- Si el cache es mas joven que el TTL y no se fuerza, NO se llama a nadie.
- forceRefresh ignora el TTL, consulta providers, upsert (dedupe por URL /
  Proveedor+ExternalId) y devuelve lo mas reciente.
- Si TODOS los providers fallan, se devuelve el cache (con warning): jamas
  se pierde lo que ya habia.
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.config import env_settings
from app.models import Noticia
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.noticias_repository import NoticiasRepository
from app.repositories.sql_utils import utcnow
from app.services.news.google_news_provider import GoogleNewsProvider
from app.services.news.news_provider_base import NewsProviderBase
from app.services.news.yahoo_news_provider import YahooNewsProvider

logger = logging.getLogger("news_orchestrator")


def _providers() -> list[NewsProviderBase]:
    providers: list[NewsProviderBase] = []
    if env_settings.ENABLE_YAHOO_NEWS_PROVIDER:
        providers.append(YahooNewsProvider())
    if env_settings.ENABLE_GOOGLE_NEWS_PROVIDER:
        providers.append(GoogleNewsProvider())
    return providers


def _row_to_dict(row: Noticia) -> dict:
    return {
        "id": row.C060Id,
        "title": row.Titulo,
        "summary": row.Resumen,
        "url": row.URL,
        "publisher": row.Publisher,
        "provider": row.Proveedor,
        "category": row.Categoria,
        "publishedAt": row.FechaPublicacion.isoformat() if row.FechaPublicacion else None,
        "fetchedAt": row.FechaObtencion.isoformat() if row.FechaObtencion else None,
        "imageUrl": row.ImagenURL,
        "relatedTickers": [],
    }


# Tokens en mayusculas que NO son tickers aunque existan como palabra.
_TICKER_STOPWORDS = {"USA", "CEO", "ETF", "AI", "IPO", "GDP", "CPI", "PPI", "FED", "SEC", "DOJ", "FTC", "US", "UK", "EU"}


def _known_tickers(db: Session) -> dict[str, int]:
    """Tickers conocidos (C010): TickerNormalizado/YahooSymbol -> C010Id."""
    from sqlalchemy import select

    from app.models import Accion

    out: dict[str, int] = {}
    try:
        for accion in db.execute(select(Accion)).scalars():
            for key in (accion.Ticker, accion.YahooSymbol):
                if key:
                    out[key.strip().upper()] = accion.C010Id
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sin tickers conocidos: %s", type(exc).__name__)
    return out


def _extract_tickers(item_title: str, related: list[str], known: dict[str, int]) -> list[int]:
    """C010Ids relacionados: primero relatedTickers del proveedor, luego
    tokens en MAYUSCULAS del titulo que coincidan con tickers de C010
    (evitando falsos positivos tipo USA/CEO/ETF)."""
    import re

    ids: list[int] = []
    seen: set[int] = set()
    for ticker in related:
        c010_id = known.get(ticker.strip().upper())
        if c010_id is not None and c010_id not in seen:
            ids.append(c010_id)
            seen.add(c010_id)
    for token in re.findall(r"\b[A-Z]{2,5}\b", item_title or ""):
        if token in _TICKER_STOPWORDS:
            continue
        c010_id = known.get(token)
        if c010_id is not None and c010_id not in seen:
            ids.append(c010_id)
            seen.add(c010_id)
    return ids


def _store_items(
    repo: NoticiasRepository, items, known_tickers: dict[str, int]
) -> int:
    """Upsert + vinculo de tickers; devuelve cuantos items se procesaron."""
    count = 0
    for item in items:
        noticia = repo.upsert_news_item(item)
        for c010_id in _extract_tickers(item.title, item.relatedTickers, known_tickers):
            repo.link_news_to_action(noticia.C060Id, c010_id)
        count += 1
    return count


def _movers_tickers(db: Session) -> list[str]:
    """Tickers de los snapshots de market movers (sin llamar al proveedor)."""
    try:
        from app.repositories.market_movers_repository import MarketMoversRepository

        repo = MarketMoversRepository(db)
        tickers: list[str] = []
        for list_type in ("TRENDING", "TOP_GAINERS", "TOP_LOSERS", "MOST_ACTIVE"):
            _, items = repo.get_latest_snapshot_items(list_type, limit=10)
            tickers.extend(i.Ticker for i in items)
        # Unicos preservando orden.
        seen: set[str] = set()
        return [t for t in tickers if not (t in seen or seen.add(t))]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sin tickers de movers: %s", type(exc).__name__)
        return []


def _aggregate_global_sources(db: Session, repo: NoticiasRepository) -> tuple[list[str], list[str]]:
    """Consulta TODAS las fuentes globales y guarda en cache.

    Devuelve (sourcesUsed, warnings). Cada fuente es best-effort.
    """
    from app.services.news.google_news_provider import GoogleNewsProvider
    from app.services.news.yahoo_news_provider import YahooNewsProvider

    known = _known_tickers(db)
    limit = env_settings.NEWS_MAX_ITEMS_PER_PROVIDER
    sources_used: list[str] = []
    warnings: list[str] = []

    yahoo = YahooNewsProvider()
    google = GoogleNewsProvider()
    movers = _movers_tickers(db)

    fetchers = [
        ("YAHOO_FINANCE_LATEST", lambda: yahoo.get_yahoo_latest_news(limit)),
        ("YAHOO_FINANCE_TOP", lambda: yahoo.get_yahoo_top_market_news(limit)),
        (
            "YAHOO_FINANCE_TRENDING_STOCKS",
            lambda: yahoo.get_yahoo_trending_stock_news(
                movers,
                per_ticker=env_settings.NEWS_TRENDING_STOCKS_NEWS_PER_TICKER,
                limit=limit,
            ),
        ),
        ("GOOGLE_NEWS", lambda: google.get_global_market_news(limit=limit)),
        ("GOOGLE_NEWS_GEO", lambda: google.get_global_geopolitical_market_news(limit)),
        ("GOOGLE_NEWS_TRENDING", lambda: google.get_top_trending_stock_news(limit)),
    ]

    for label, fetch in fetchers:
        try:
            items = fetch()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Fuente %s fallo: %s", label, type(exc).__name__)
            items = []
        if items:
            stored = _store_items(repo, items, known)
            sources_used.append(label)
            if env_settings.NEWS_DEBUG:
                logger.info("Fuente %s: %d items almacenados", label, stored)
        else:
            warnings.append(f"Fuente {label} sin resultados")
    return sources_used, warnings


def get_global_news(
    db: Session,
    category: str | None = None,
    limit: int = 50,
    force_refresh: bool = False,
    source: str | None = None,
) -> dict:
    from app.services.news.news_types import resolve_category

    repo = NoticiasRepository(db)
    ttl = env_settings.NEWS_GLOBAL_TTL_MINUTES
    warnings: list[str] = []
    sources_used: list[str] = []
    category_name = resolve_category(category)

    newest = repo.newest_fetch_time()
    is_fresh = (
        newest is not None
        and (utcnow() - newest).total_seconds() < ttl * 60
    )

    fetched = False
    if force_refresh or not is_fresh:
        sources_used, _fetch_warnings = _aggregate_global_sources(db, repo)
        if sources_used:
            db.commit()
            fetched = True
        else:
            warnings.append(
                "No se pudieron actualizar algunas fuentes; se muestran los titulares en cache"
            )

    # Ranking en lectura: frescura primero, con boost por calidad de fuente,
    # keywords de impacto de mercado y categoria (dashboard de mercado, no
    # busqueda web generica). Se trae un excedente y se recorta tras ordenar.
    from app.services.news.news_relevance import global_rank_score

    rows = repo.list_global_news(
        category=category_name, limit=min(limit * 3, 150), source=source
    )
    now = utcnow()
    rows.sort(
        key=lambda r: global_rank_score(
            r.Titulo, r.Resumen, r.Publisher, r.Categoria, r.FechaPublicacion, now
        ),
        reverse=True,
    )
    rows = rows[:limit]
    newest = repo.newest_fetch_time()
    return {
        "items": [_row_to_dict(r) for r in rows],
        "lastUpdated": newest.isoformat() if newest else None,
        "fromCache": not fetched,
        "sourcesUsed": sources_used,
        "warnings": warnings,
    }


def get_top_trending_stock_news(
    db: Session, limit: int = 30, force_refresh: bool = False
) -> dict:
    """Noticias de acciones en movimiento HOY (seccion propia en /news)."""
    from app.services.news.news_types import CATEGORY_TRENDING

    repo = NoticiasRepository(db)
    ttl = env_settings.NEWS_TRENDING_STOCKS_TTL_MINUTES
    warnings: list[str] = []

    rows = repo.list_global_news(category=CATEGORY_TRENDING, limit=1)
    newest = rows[0].FechaObtencion if rows else None
    is_fresh = (
        newest is not None
        and (utcnow() - newest).total_seconds() < ttl * 60
    )

    fetched = False
    if force_refresh or not is_fresh:
        from app.services.news.google_news_provider import GoogleNewsProvider
        from app.services.news.yahoo_news_provider import YahooNewsProvider

        known = _known_tickers(db)
        movers = _movers_tickers(db)
        got_any = False
        for fetch in (
            lambda: YahooNewsProvider().get_yahoo_trending_stock_news(
                movers,
                per_ticker=env_settings.NEWS_TRENDING_STOCKS_NEWS_PER_TICKER,
                limit=limit,
            ),
            lambda: GoogleNewsProvider().get_top_trending_stock_news(limit),
        ):
            try:
                items = fetch()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Trending stocks fallo: %s", type(exc).__name__)
                items = []
            if items:
                # Todas las noticias de esta seccion llevan su categoria.
                for item in items:
                    item.category = CATEGORY_TRENDING
                _store_items(repo, items, known)
                got_any = True
        if got_any:
            db.commit()
            fetched = True
        elif force_refresh:
            warnings.append(
                "No se pudieron actualizar las noticias de trending; se muestra el cache"
            )

    rows = repo.list_global_news(category=CATEGORY_TRENDING, limit=limit)
    items_out = [_row_to_dict(r) for r in rows]

    # Tickers relacionados (C061 -> C010) en un solo query.
    ids = [r.C060Id for r in rows]
    if ids:
        from sqlalchemy import select

        from app.models import Accion, NoticiaInstrumento

        links: dict[int, list[str]] = {}
        for c060_id, ticker in db.execute(
            select(NoticiaInstrumento.C060Id, Accion.Ticker)
            .join(Accion, Accion.C010Id == NoticiaInstrumento.C010Id)
            .where(NoticiaInstrumento.C060Id.in_(ids))
        ).all():
            links.setdefault(c060_id, []).append(ticker)
        for item in items_out:
            item["relatedTickers"] = links.get(item["id"], [])

    last = rows[0].FechaObtencion.isoformat() if rows else None
    return {
        "items": items_out,
        "lastUpdated": last,
        "fromCache": not fetched,
        "warnings": warnings,
    }


# Proveedores cuyos feeds por simbolo YA estan vinculados al ticker en
# origen (Yahoo consulta por ticker): reciben el bono provider_linked.
_TICKER_LINKED_PROVIDERS = ("YAHOO_FINANCE_SYMBOL", "YAHOO_FINANCE_TRENDING_STOCKS")


def get_symbol_news(
    db: Session,
    symbol: str,
    limit: int = 30,
    force_refresh: bool = False,
) -> dict:
    """Noticias del simbolo activo con relevancia ESTRICTA.

    - Consultas company-aware desde la metadata de C010 (nunca el ticker
      crudo solo: OPEN/AI/ON son palabras comunes en ingles).
    - Solo lo que pasa el umbral de relevancia se vincula en C061; lo
      irrelevante con valor global queda en C060 SIN vinculo.
    - En lectura se RE-puntua (limpia vinculos viejos contaminados) y cada
      item lleva relevanceScore/relevanceReason para diagnostico.
    """
    from app.services.news import news_relevance
    from app.services.news.news_types import NewsItem

    symbol = symbol.strip().upper()
    repo = NoticiasRepository(db)
    acciones = AccionesRepository(db)
    accion = acciones.get_or_create_from_yahoo_symbol(symbol)
    db.commit()

    threshold = news_relevance.relevance_threshold(accion)
    ttl = env_settings.NEWS_SYMBOL_TTL_MINUTES
    warnings: list[str] = []
    newest = repo.newest_fetch_time(accion.C010Id)
    is_fresh = (
        newest is not None
        and (utcnow() - newest).total_seconds() < ttl * 60
    )

    fetched = False
    if force_refresh or not is_fresh:
        queries = news_relevance.build_symbol_news_queries(accion)
        if env_settings.NEWS_DEBUG:
            logger.info(
                "Symbol news %s (empresa=%s, yahoo=%s, umbral=%d): consultas=%s",
                symbol,
                accion.NombreInstrumento,
                accion.YahooSymbol,
                threshold,
                queries,
            )
        got_any = False
        accepted = rejected = 0
        for provider in _providers():
            try:
                # Google usa consultas company-aware; Yahoo va por ticker
                # (sus feeds por simbolo ya estan vinculados en origen).
                if hasattr(provider, "get_symbol_news_for_instrument"):
                    items = provider.get_symbol_news_for_instrument(
                        accion, queries, limit=limit
                    )
                else:
                    items = provider.get_symbol_news(symbol, limit=limit)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Provider %s fallo: %s", provider.name, type(exc).__name__)
                items = []
            if not items:
                continue
            got_any = True
            for item in items:
                score, reason = news_relevance.score_symbol_news_relevance(
                    item, accion
                )
                if score >= threshold:
                    noticia = repo.upsert_news_item(item)
                    repo.link_news_to_action(
                        noticia.C060Id, accion.C010Id, relevance=float(score)
                    )
                    accepted += 1
                else:
                    rejected += 1
                    if env_settings.NEWS_DEBUG:
                        logger.info(
                            "Rechazada para %s: '%s' (score %d < %d): %s",
                            symbol,
                            (item.title or "")[:80],
                            score,
                            threshold,
                            reason,
                        )
                    # Con valor de mercado global: se guarda en C060 pero
                    # JAMAS se vincula al instrumento via C061.
                    if item.category and item.category != "Other":
                        repo.upsert_news_item(item)
        if got_any:
            db.commit()
            fetched = True
            if env_settings.NEWS_DEBUG:
                logger.info(
                    "Symbol news %s: %d aceptadas, %d rechazadas (umbral %d)",
                    symbol,
                    accepted,
                    rejected,
                    threshold,
                )
        elif force_refresh:
            warnings.append("No se pudieron actualizar las noticias; se muestra el cache")

    # Lectura con RE-score: filtra tambien vinculos C061 historicos que ya
    # no pasarian el umbral (contaminacion previa a este filtro).
    rows = repo.list_symbol_news(accion.C010Id, limit=limit * 2)
    newest = repo.newest_fetch_time(accion.C010Id)
    items_out: list[dict] = []
    for row in rows:
        pseudo = NewsItem(
            title=row.Titulo,
            url=row.URL,
            provider=row.Proveedor,
            summary=row.Resumen,
        )
        score, reason = news_relevance.score_symbol_news_relevance(
            pseudo,
            accion,
            provider_linked=row.Proveedor in _TICKER_LINKED_PROVIDERS,
        )
        if score < threshold:
            if env_settings.NEWS_DEBUG:
                logger.info(
                    "Cache filtrado para %s: '%s' (score %d < %d): %s",
                    symbol,
                    (row.Titulo or "")[:80],
                    score,
                    threshold,
                    reason,
                )
            continue
        item_dict = _row_to_dict(row)
        item_dict["relatedTickers"] = [symbol]
        item_dict["relevanceScore"] = score
        item_dict["relevanceReason"] = reason
        items_out.append(item_dict)
        if len(items_out) >= limit:
            break

    out = {
        "symbol": symbol,
        "items": items_out,
        "lastUpdated": newest.isoformat() if newest else None,
        "fromCache": not fetched,
        "warnings": warnings,
    }
    if not items_out:
        out["message"] = (
            f"No highly relevant recent news found for {symbol}."
        )
    return out
