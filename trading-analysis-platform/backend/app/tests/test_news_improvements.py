"""Tests de las mejoras de noticias: clasificador policy/trending, dedupe de
URL normalizada, filtro por fuente, endpoint de trending, extraccion de
tickers y guard de dibujos bloqueados."""
from __future__ import annotations

from datetime import datetime

import pytest
from sqlalchemy import select

from app.models import Noticia, NoticiaInstrumento
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.noticias_repository import NoticiasRepository, normalize_url
from app.services.news import news_service as news_orchestrator
from app.services.news.google_news_provider import GoogleNewsProvider
from app.services.news.news_types import (
    CATEGORY_GEOPOLITICS,
    CATEGORY_TRENDING,
    NewsItem,
    classify_category,
    resolve_category,
)
from app.services.news.yahoo_news_provider import YahooNewsProvider
from app.tests.conftest import login_headers, make_user


# ===== Clasificador =====


def test_policy_headlines_classify_as_geopolitics_policy():
    cases = [
        "Stocks rally after Trump's six-year trade deal is near",
        "White House weighs new tariffs on Chinese imports",
        "Government shutdown looms over Wall Street",
        "Senate passes tax bill affecting tech companies",
    ]
    for title in cases:
        assert classify_category(title) == CATEGORY_GEOPOLITICS, title


def test_stock_mover_headlines_classify_as_trending():
    cases = [
        "Biggest movers today: Tesla, Nvidia and AMD",
        "Premarket movers: what's moving before the bell",
        "These are the top gainers of the session",
        "Stocks to watch today before the open",
    ]
    for title in cases:
        assert classify_category(title) == CATEGORY_TRENDING, title


def test_resolve_category_accepts_slugs_and_names():
    assert resolve_category("geopolitics_policy") == CATEGORY_GEOPOLITICS
    assert resolve_category("top_trending_stocks_today") == CATEGORY_TRENDING
    assert resolve_category("Energy") == "Energy"
    assert resolve_category("all") is None
    assert resolve_category(None) is None


# ===== Normalizacion de URL / dedupe =====


def test_normalize_url_strips_tracking_and_trailing_slash():
    a = normalize_url("https://Example.com/news/story/?utm_source=x&utm_medium=y")
    b = normalize_url("https://example.com/news/story")
    assert a == b


def test_dedupe_by_normalized_url(db_session):
    repo = NoticiasRepository(db_session)
    repo.upsert_news_item(
        NewsItem(title="t", url="https://x.com/a?utm_source=feed", provider="GOOGLE_NEWS")
    )
    repo.upsert_news_item(
        NewsItem(title="t2", url="https://X.com/a/", provider="YAHOO_FINANCE_LATEST")
    )
    db_session.commit()
    rows = list(db_session.execute(select(Noticia)).scalars())
    assert len(rows) == 1  # misma URL normalizada => una fila


# ===== Filtro por fuente =====


def test_source_filter(client, db_session, monkeypatch):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    repo = NoticiasRepository(db_session)
    repo.upsert_news_item(
        NewsItem(title="de yahoo", url="https://y.com/1", provider="YAHOO_FINANCE_LATEST")
    )
    repo.upsert_news_item(
        NewsItem(title="de google", url="https://g.com/1", provider="GOOGLE_NEWS")
    )
    db_session.commit()

    yahoo = client.get("/api/news/global?source=yahoo", headers=headers).json()
    assert [i["title"] for i in yahoo["items"]] == ["de yahoo"]
    google = client.get("/api/news/global?source=google", headers=headers).json()
    assert [i["title"] for i in google["items"]] == ["de google"]
    todas = client.get("/api/news/global?source=all", headers=headers).json()
    assert len(todas["items"]) == 2


# ===== Top Trending Stocks Today =====


def test_top_trending_endpoint(client, db_session, monkeypatch):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")

    trending_item = NewsItem(
        title="Biggest movers today: NVDA surges",
        url="https://x.com/movers",
        provider="YAHOO_FINANCE_TRENDING_STOCKS",
        publishedAt=datetime(2026, 6, 11, 13, 0),
        relatedTickers=["NVDA"],
    )
    monkeypatch.setattr(
        YahooNewsProvider,
        "get_yahoo_trending_stock_news",
        lambda self, tickers, per_ticker=3, limit=50: [trending_item],
    )
    monkeypatch.setattr(
        GoogleNewsProvider, "get_top_trending_stock_news", lambda self, limit=50: []
    )

    r = client.get("/api/news/top-trending-stocks-today", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["category"] == CATEGORY_TRENDING
    assert "NVDA" in body["items"][0]["title"]

    # Requiere auth.
    assert client.get("/api/news/top-trending-stocks-today").status_code == 401


# ===== Extraccion de tickers =====


def test_related_tickers_extracted_and_linked(client, db_session, monkeypatch):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    accion = AccionesRepository(db_session).get_or_create_from_yahoo_symbol("NVDA")
    db_session.commit()

    item = NewsItem(
        title="NVDA stock surges after earnings; USA economy strong",
        url="https://x.com/nvda",
        provider="GOOGLE_NEWS",
    )
    monkeypatch.setattr(
        news_orchestrator,
        "_aggregate_global_sources",
        lambda db, repo: (
            news_orchestrator._store_items(
                repo, [item], news_orchestrator._known_tickers(db)
            ),
            [],
        )
        and (["FAKE"], []),
    )
    client.get("/api/news/global?forceRefresh=true", headers=headers)

    links = list(
        db_session.execute(
            select(NoticiaInstrumento).where(NoticiaInstrumento.C010Id == accion.C010Id)
        ).scalars()
    )
    assert len(links) == 1  # NVDA detectado en el titulo; "USA" ignorado


# ===== Dibujos bloqueados =====


DRAWING = {
    "symbol": "AAPL",
    "sourceTimeframe": "1Y_1D",
    "type": "free_line",
    "points": [{"time": 1700000000000, "price": 100.0}, {"time": 1700600000000, "price": 110.0}],
    "style": {"color": "#fff", "width": 2, "lineStyle": "solid", "opacity": 1},
}


def test_locked_drawing_cannot_be_moved(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    created = client.post(
        "/api/drawings", json={**DRAWING, "locked": True}, headers=headers
    ).json()

    moved = {**DRAWING, "locked": True, "points": [
        {"time": 1700000000000, "price": 105.0},
        {"time": 1700600000000, "price": 115.0},
    ]}
    r = client.patch(f"/api/drawings/{created['id']}", json=moved, headers=headers)
    assert r.status_code == 423  # bloqueado

    # Desbloquear explicitamente SI se permite.
    unlocked = {**moved, "locked": False}
    r2 = client.patch(f"/api/drawings/{created['id']}", json=unlocked, headers=headers)
    assert r2.status_code == 200
    assert r2.json()["points"][0]["price"] == 105.0


def test_patch_drawing_of_another_user_404(client, db_session):
    make_user(db_session, "Ana", "ana@example.com")
    make_user(db_session, "Beto", "beto@example.com")
    ha = login_headers(client, "Ana")
    hb = login_headers(client, "Beto")
    created = client.post("/api/drawings", json=DRAWING, headers=ha).json()
    r = client.patch(f"/api/drawings/{created['id']}", json=DRAWING, headers=hb)
    assert r.status_code == 404
