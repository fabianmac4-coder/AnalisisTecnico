"""Tests de noticias y market movers (cache SQL C060-C063, sin red)."""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import ListaMercado, ListaMercadoDetalle, Noticia, NoticiaInstrumento
from app.repositories.acciones_repository import AccionesRepository
from app.repositories.noticias_repository import NoticiasRepository
from app.services.market_movers import market_movers_service
from app.services.market_movers.market_movers_types import MarketMoverItem
from app.services.news import news_service as news_orchestrator
from app.services.news.news_types import NewsItem, classify_category
from app.tests.conftest import login_headers, make_user


def _news(title="Fed signals rate cut", url="https://x.com/a", provider="GOOGLE_NEWS"):
    return NewsItem(
        title=title,
        url=url,
        provider=provider,
        publisher="Reuters",
        publishedAt=datetime(2026, 6, 11, 12, 0),
        category=classify_category(title),
    )


class _FakeNewsProvider:
    name = "GOOGLE_NEWS"

    def __init__(self, items):
        self.items = items
        self.calls = 0

    def get_global_market_news(self, category=None, limit=50):
        self.calls += 1
        return self.items

    def get_symbol_news(self, symbol, limit=30):
        self.calls += 1
        return self.items


class _FakeAggregate:
    """Reemplaza la agregacion global (multi-fuente) por una fuente fake."""

    def __init__(self, items):
        self.items = items
        self.calls = 0

    def __call__(self, db, repo):
        self.calls += 1
        for item in self.items:
            repo.upsert_news_item(item)
        return (["FAKE_SOURCE"], [])


@pytest.fixture()
def fake_provider(monkeypatch):
    items = [_news()]
    aggregate = _FakeAggregate(items)
    monkeypatch.setattr(news_orchestrator, "_aggregate_global_sources", aggregate)
    # El flujo por simbolo sigue usando _providers.
    provider = _FakeNewsProvider(items)
    monkeypatch.setattr(news_orchestrator, "_providers", lambda: [provider])
    provider.aggregate = aggregate
    return provider


class _FakeMoversProvider:
    name = "YAHOO"

    def __init__(self):
        self.calls = 0

    def get_list(self, list_type, limit=25):
        self.calls += 1
        return [
            MarketMoverItem(
                symbol="NVDA",
                source=self.name,
                name="NVIDIA Corp",
                price=1200.5,
                change=50.2,
                changePercent=4.36,
                volume=30_000_000,
                marketCap=2.9e12,
            )
        ]


@pytest.fixture()
def fake_movers(monkeypatch):
    provider = _FakeMoversProvider()
    monkeypatch.setattr(market_movers_service, "_provider", provider)
    return provider


# ===== Auth =====


def test_news_and_movers_require_auth(client, db_session):
    assert client.get("/api/news/global").status_code == 401
    assert client.get("/api/news/symbol/AAPL").status_code == 401
    assert client.get("/api/market-movers").status_code == 401


# ===== Noticias =====


def test_global_news_fetches_and_caches(client, db_session, fake_provider):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")

    r1 = client.get("/api/news/global", headers=headers)
    assert r1.status_code == 200
    body = r1.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["title"] == "Fed signals rate cut"
    assert body["items"][0]["category"] == "Fed / Rates"
    assert body["sourcesUsed"] == ["FAKE_SOURCE"]
    assert fake_provider.aggregate.calls == 1

    # Cache fresco: la segunda llamada NO toca el provider.
    r2 = client.get("/api/news/global", headers=headers)
    assert r2.json()["fromCache"] is True
    assert fake_provider.aggregate.calls == 1

    # forceRefresh si lo toca.
    client.get("/api/news/global?forceRefresh=true", headers=headers)
    assert fake_provider.aggregate.calls == 2


def test_news_dedupe_by_url(client, db_session, fake_provider):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    client.get("/api/news/global", headers=headers)
    client.get("/api/news/global?forceRefresh=true", headers=headers)
    rows = list(db_session.execute(select(Noticia)).scalars())
    assert len(rows) == 1  # misma URL => una sola fila


def test_symbol_news_links_to_c010(client, db_session, fake_provider):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    # El panel del simbolo ahora es ESTRICTO: el item debe ser relevante
    # para AAPL (contexto bursatil del ticker), no un titular generico.
    fake_provider.items = [
        _news("Apple (AAPL) stock rises after earnings beat", "https://x.com/aapl")
    ]
    r = client.get("/api/news/symbol/AAPL", headers=headers)
    assert r.status_code == 200
    assert r.json()["symbol"] == "AAPL"
    assert len(r.json()["items"]) == 1
    assert r.json()["items"][0]["relevanceScore"] >= 40

    accion = AccionesRepository(db_session).get_by_yahoo_symbol("AAPL")
    links = list(
        db_session.execute(
            select(NoticiaInstrumento).where(NoticiaInstrumento.C010Id == accion.C010Id)
        ).scalars()
    )
    assert len(links) == 1


def test_news_provider_failure_returns_cache(client, db_session, monkeypatch):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")

    monkeypatch.setattr(
        news_orchestrator, "_aggregate_global_sources", _FakeAggregate([_news()])
    )
    client.get("/api/news/global", headers=headers)

    # Ahora TODAS las fuentes fallan: el cache sobrevive y hay warning.
    monkeypatch.setattr(
        news_orchestrator,
        "_aggregate_global_sources",
        lambda db, repo: ([], ["x"]),
    )
    r = client.get("/api/news/global?forceRefresh=true", headers=headers)
    assert r.status_code == 200
    assert len(r.json()["items"]) == 1  # cache intacto
    assert any("cache" in w for w in r.json()["warnings"])


def test_category_filter(client, db_session, monkeypatch):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    monkeypatch.setattr(
        news_orchestrator,
        "_aggregate_global_sources",
        _FakeAggregate(
            [
                _news("Fed signals rate cut", "https://x.com/fed"),
                _news("Oil prices surge on OPEC output cuts", "https://x.com/oil"),
            ]
        ),
    )
    client.get("/api/news/global", headers=headers)
    r = client.get("/api/news/global?category=Energy", headers=headers)
    items = r.json()["items"]
    assert len(items) == 1
    assert "Oil" in items[0]["title"]
    # Tambien acepta el slug de la API.
    r2 = client.get("/api/news/global?category=fed_rates", headers=headers)
    assert len(r2.json()["items"]) == 1
    assert "Fed" in r2.json()["items"][0]["title"]


def test_news_cleanup(db_session, fake_provider):
    repo = NoticiasRepository(db_session)
    old = repo.upsert_news_item(_news("vieja", "https://x.com/old"))
    old.FechaObtencion = datetime.utcnow() - timedelta(days=60)
    db_session.commit()
    deleted = repo.cleanup_old_news(days=30)
    assert deleted == 1


# ===== Market movers =====


def test_movers_returns_four_lists_and_snapshots(client, db_session, fake_movers):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    r = client.get("/api/market-movers", headers=headers)
    assert r.status_code == 200
    body = r.json()
    for key in ("trending", "topGainers", "topLosers", "mostActive"):
        assert key in body
        assert body[key]["items"][0]["symbol"] == "NVDA"
        assert body[key]["items"][0]["ranking"] == 1

    # Snapshots C062 + detalle C063 persistidos.
    snapshots = list(db_session.execute(select(ListaMercado)).scalars())
    assert len(snapshots) == 4
    detalles = list(db_session.execute(select(ListaMercadoDetalle)).scalars())
    assert len(detalles) == 4
    assert detalles[0].Ticker == "NVDA"


def test_movers_cache_and_force_refresh(client, db_session, fake_movers):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    client.get("/api/market-movers", headers=headers)
    assert fake_movers.calls == 4
    client.get("/api/market-movers", headers=headers)
    assert fake_movers.calls == 4  # cache fresco
    client.post("/api/market-movers/refresh", headers=headers)
    assert fake_movers.calls == 8  # force => 4 listas de nuevo


def test_movers_single_list_endpoint(client, db_session, fake_movers):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    r = client.get("/api/market-movers/top-gainers", headers=headers)
    assert r.status_code == 200
    assert r.json()["listType"] == "TOP_GAINERS"
    assert r.json()["items"][0]["changePercent"] == 4.36
    assert client.get("/api/market-movers/bogus", headers=headers).status_code == 400


def test_no_sensitive_data_in_responses(client, db_session, fake_provider, fake_movers):
    user = make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    r1 = client.get("/api/news/global", headers=headers)
    r2 = client.get("/api/market-movers", headers=headers)
    for text in (r1.text, r2.text):
        assert "PasswordHash" not in text
        assert user.PasswordHash not in text
