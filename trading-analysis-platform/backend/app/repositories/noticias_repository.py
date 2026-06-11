"""Repositorio del cache SQL de noticias (dbo.C060/C061)."""
from __future__ import annotations

import json
from datetime import timedelta

from sqlalchemy import case, delete, select
from sqlalchemy.orm import Session

from app.models import Noticia, NoticiaInstrumento
from app.repositories.sql_utils import utcnow
from app.services.news.news_types import NewsItem

# SQL Server NO soporta "NULLS LAST": se emula con CASE (portable a SQLite).
_NULL_DATES_LAST = case((Noticia.FechaPublicacion.is_(None), 1), else_=0)

# Parametros de tracking que se eliminan al normalizar URLs (dedupe).
_TRACKING_PARAMS = ("utm_", "guce", "guccounter", "ncid", "soc_src", "soc_trk")


def normalize_url(url: str) -> str:
    """Normaliza la URL para deduplicar: dominio en minusculas, sin slash
    final y sin parametros de tracking conocidos."""
    from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

    try:
        parts = urlsplit(url.strip())
        query = [
            (k, v)
            for k, v in parse_qsl(parts.query, keep_blank_values=True)
            if not any(k.lower().startswith(t) for t in _TRACKING_PARAMS)
        ]
        path = parts.path.rstrip("/") or "/"
        return urlunsplit(
            (parts.scheme.lower(), parts.netloc.lower(), path, urlencode(query), "")
        )
    except ValueError:
        return url.strip()


class NoticiasRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def upsert_news_item(self, item: NewsItem) -> Noticia:
        """Inserta o refresca una noticia SIN duplicar.

        Dedupe: primero por URL NORMALIZADA (sin tracking params); si hay
        ExternalId, por (Proveedor, ExternalId). Si ya existe, actualiza
        metadatos y FechaObtencion.
        """
        item.url = normalize_url(item.url)
        existing = self.db.execute(
            select(Noticia).where(Noticia.URL == item.url)
        ).scalar_one_or_none()
        if existing is None and item.externalId:
            existing = self.db.execute(
                select(Noticia).where(
                    Noticia.Proveedor == item.provider,
                    Noticia.ExternalId == item.externalId,
                )
            ).scalar_one_or_none()

        now = utcnow()
        if existing is not None:
            existing.Titulo = item.title[:500]
            existing.Resumen = item.summary
            existing.Publisher = (item.publisher or "")[:250] or None
            existing.Categoria = item.category
            existing.FechaPublicacion = item.publishedAt or existing.FechaPublicacion
            existing.FechaObtencion = now
            existing.Activo = True
            self.db.flush()
            return existing

        noticia = Noticia(
            Proveedor=item.provider,
            ExternalId=(item.externalId or "")[:255] or None,
            Titulo=item.title[:500],
            Resumen=item.summary,
            URL=item.url[:1000],
            Publisher=(item.publisher or "")[:250] or None,
            ImagenURL=(item.imageUrl or "")[:1000] or None,
            Categoria=item.category,
            Idioma=item.language,
            Pais=item.country,
            FechaPublicacion=item.publishedAt,
            FechaObtencion=now,
            RawJSON=json.dumps(item.raw) if item.raw else None,
            Activo=True,
        )
        self.db.add(noticia)
        self.db.flush()
        return noticia

    def link_news_to_action(
        self, c060_id: int, c010_id: int, relevance: float | None = None
    ) -> None:
        existing = self.db.execute(
            select(NoticiaInstrumento).where(
                NoticiaInstrumento.C060Id == c060_id,
                NoticiaInstrumento.C010Id == c010_id,
            )
        ).scalar_one_or_none()
        if existing is not None:
            return
        self.db.add(
            NoticiaInstrumento(
                C060Id=c060_id,
                C010Id=c010_id,
                Relevancia=relevance,
                FechaCreacion=utcnow(),
            )
        )
        self.db.flush()

    def list_global_news(
        self,
        category: str | None = None,
        limit: int = 50,
        max_age_minutes: int | None = None,
        source: str | None = None,
    ) -> list[Noticia]:
        query = select(Noticia).where(Noticia.Activo == True)  # noqa: E712
        if category and category != "All":
            query = query.where(Noticia.Categoria == category)
        if source == "yahoo":
            query = query.where(Noticia.Proveedor.like("YAHOO%"))
        elif source == "google":
            query = query.where(Noticia.Proveedor == "GOOGLE_NEWS")
        if max_age_minutes is not None:
            query = query.where(
                Noticia.FechaObtencion >= utcnow() - timedelta(minutes=max_age_minutes)
            )
        return list(
            self.db.execute(
                query.order_by(
                    _NULL_DATES_LAST,
                    Noticia.FechaPublicacion.desc(),
                    Noticia.C060Id.desc(),
                ).limit(limit)
            ).scalars()
        )

    def list_symbol_news(
        self,
        c010_id: int,
        limit: int = 30,
        max_age_minutes: int | None = None,
    ) -> list[Noticia]:
        query = (
            select(Noticia)
            .join(NoticiaInstrumento, NoticiaInstrumento.C060Id == Noticia.C060Id)
            .where(
                NoticiaInstrumento.C010Id == c010_id,
                Noticia.Activo == True,  # noqa: E712
            )
        )
        if max_age_minutes is not None:
            query = query.where(
                Noticia.FechaObtencion >= utcnow() - timedelta(minutes=max_age_minutes)
            )
        return list(
            self.db.execute(
                query.order_by(
                    _NULL_DATES_LAST,
                    Noticia.FechaPublicacion.desc(),
                    Noticia.C060Id.desc(),
                ).limit(limit)
            ).scalars()
        )

    def newest_fetch_time(self, c010_id: int | None = None):
        """FechaObtencion mas reciente (global o del instrumento) para el TTL."""
        if c010_id is None:
            query = select(Noticia.FechaObtencion).order_by(
                Noticia.FechaObtencion.desc()
            )
        else:
            query = (
                select(Noticia.FechaObtencion)
                .join(NoticiaInstrumento, NoticiaInstrumento.C060Id == Noticia.C060Id)
                .where(NoticiaInstrumento.C010Id == c010_id)
                .order_by(Noticia.FechaObtencion.desc())
            )
        return self.db.execute(query.limit(1)).scalar_one_or_none()

    def cleanup_old_news(self, days: int = 30) -> int:
        """Borra noticias (y sus relaciones) mas viejas que `days`."""
        cutoff = utcnow() - timedelta(days=days)
        old_ids = [
            row
            for row in self.db.execute(
                select(Noticia.C060Id).where(Noticia.FechaObtencion < cutoff)
            ).scalars()
        ]
        if not old_ids:
            return 0
        self.db.execute(
            delete(NoticiaInstrumento).where(NoticiaInstrumento.C060Id.in_(old_ids))
        )
        self.db.execute(delete(Noticia).where(Noticia.C060Id.in_(old_ids)))
        self.db.flush()
        return len(old_ids)
