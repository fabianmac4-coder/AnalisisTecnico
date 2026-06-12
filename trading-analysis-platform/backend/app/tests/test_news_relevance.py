"""Tests de relevancia de noticias por simbolo (tickers ambiguos) y de la
amplitud/ranking de las noticias globales. Sin red."""
from __future__ import annotations

from datetime import datetime

import pytest
from sqlalchemy import select

from app.config import env_settings
from app.models import Noticia, NoticiaInstrumento
from app.repositories.acciones_repository import AccionesRepository
from app.services.news import news_relevance as nr
from app.services.news import news_service as news_orchestrator
from app.services.news.google_news_provider import (
    FED_MACRO_QUERIES,
    GEOPOLITICAL_MARKET_QUERIES,
    GLOBAL_MARKET_QUERIES,
    SECTOR_QUERIES,
    TRENDING_STOCKS_QUERIES,
    _interleave,
)
from app.services.news.news_types import NewsItem, classify_category
from app.tests.conftest import login_headers, make_user


class _Inst:
    """Instrumento minimo (duck-typed como Accion) para tests unitarios."""

    def __init__(
        self,
        ticker,
        name=None,
        sector=None,
        industria=None,
        exchange=None,
        tipo="EQUITY",
    ):
        self.Ticker = ticker
        self.NombreInstrumento = name
        self.Sector = sector
        self.Industria = industria
        self.Exchange = exchange
        self.TipoInstrumento = tipo
        self.YahooSymbol = ticker


def _item(title, summary=None, url="https://news.example.com/a", related=None):
    return NewsItem(
        title=title,
        url=url,
        provider="GOOGLE_NEWS",
        summary=summary,
        publisher="Reuters",
        publishedAt=datetime(2026, 6, 12, 12, 0),
        relatedTickers=related or [],
        category=classify_category(title, summary),
    )


OPENDOOR = _Inst("OPEN", "Opendoor Technologies", "Real Estate", exchange="NASDAQ")
C3AI = _Inst("AI", "C3.ai")
ONSEMI = _Inst("ON", "ON Semiconductor")


def _passes(item, inst) -> bool:
    score, _ = nr.score_symbol_news_relevance(item, inst)
    return score >= nr.relevance_threshold(inst)


# ===== Relevancia por simbolo (tickers ambiguos) =====


def test_open_accepts_opendoor_headline():
    assert _passes(_item("Opendoor Technologies surges after earnings"), OPENDOOR)


def test_open_accepts_ticker_stock_context_with_opendoor():
    assert _passes(_item("OPEN stock jumps 20% as Opendoor rallies"), OPENDOOR)


def test_open_rejects_spacex_open_ipo():
    assert not _passes(_item("SpaceX open IPO talk heats up"), OPENDOOR)


def test_open_rejects_market_open_headlines():
    assert not _passes(_item("Stocks slip at market open on tariff fears"), OPENDOOR)


def test_open_rejects_openai_unless_opendoor_present():
    assert not _passes(_item("OpenAI announces new model"), OPENDOOR)


def test_ai_accepts_c3ai_stock():
    assert _passes(_item("C3.ai stock rises on revenue beat"), C3AI)


def test_ai_rejects_generic_ai_rally():
    assert not _passes(_item("AI stocks rally across the market"), C3AI)


def test_on_accepts_on_semiconductor_shares():
    assert _passes(_item("ON Semiconductor shares jump on chip demand"), ONSEMI)


def test_on_rejects_generic_on_phrase():
    assert not _passes(_item("New tariffs on imports weigh on stocks"), ONSEMI)
    # El alias "ON Semiconductor" es case-sensitive: "on semiconductors" en
    # minusculas dentro de una frase NO es la empresa.
    assert not _passes(
        _item("New tariffs on semiconductors weigh on stocks"), ONSEMI
    )


def test_ambiguous_tickers_use_higher_threshold():
    assert nr.relevance_threshold(OPENDOOR) == nr.RELEVANCE_THRESHOLD_AMBIGUOUS
    assert nr.relevance_threshold(_Inst("AAPL")) == nr.RELEVANCE_THRESHOLD_NORMAL
    assert nr.RELEVANCE_THRESHOLD_AMBIGUOUS > nr.RELEVANCE_THRESHOLD_NORMAL
    for ticker in ("OPEN", "AI", "ON", "NOW", "SHOP", "NET"):
        assert nr.is_ambiguous_ticker(ticker), ticker


def test_provider_related_ticker_gives_strong_relevance():
    score, reason = nr.score_symbol_news_relevance(
        _item("Opendoor cuts staff", related=["OPEN"]), OPENDOOR
    )
    assert score >= 100
    assert "proveedor" in reason


def test_query_builder_uses_company_metadata():
    queries = nr.build_symbol_news_queries(OPENDOOR)
    assert "Opendoor Technologies stock news" in queries
    assert "OPEN stock Opendoor Technologies" in queries
    assert "NASDAQ OPEN Opendoor Technologies" in queries
    # Jamas la palabra suelta para tickers ambiguos.
    assert "OPEN" not in queries
    assert "OPEN news" not in queries
    # Sin nombre: contexto bursatil explicito (los filtros hacen el resto).
    fallback = nr.build_symbol_news_queries(_Inst("XYZ"))
    assert fallback[0] == "XYZ stock news"


# ===== Endpoint: vinculo C061 SOLO si pasa relevancia =====


class _SymbolProvider:
    name = "GOOGLE_NEWS"

    def __init__(self, items):
        self.items = items

    def get_symbol_news(self, symbol, limit=30):
        return self.items


@pytest.fixture()
def open_accion(db_session):
    accion = AccionesRepository(db_session).get_or_create_from_yahoo_symbol("OPEN")
    accion.NombreInstrumento = "Opendoor Technologies"
    db_session.commit()
    return accion


def test_c061_links_only_relevant_news(client, db_session, monkeypatch, open_accion):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    provider = _SymbolProvider(
        [
            _item(
                "Opendoor Technologies stock jumps after earnings",
                url="https://news.example.com/opendoor",
            ),
            _item("SpaceX open IPO buzz grows", url="https://news.example.com/spacex"),
            # Irrelevante para OPEN pero con valor global (Fed): va a C060
            # sin vinculo C061.
            _item(
                "Stocks slip at market open on Fed fears",
                url="https://news.example.com/fed",
            ),
        ]
    )
    monkeypatch.setattr(news_orchestrator, "_providers", lambda: [provider])

    r = client.get("/api/news/symbol/OPEN?forceRefresh=true", headers=headers)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert "Opendoor" in items[0]["title"]
    assert items[0]["relevanceScore"] >= nr.RELEVANCE_THRESHOLD_AMBIGUOUS
    assert "Opendoor" in items[0]["relevanceReason"]

    links = list(
        db_session.execute(
            select(NoticiaInstrumento).where(
                NoticiaInstrumento.C010Id == open_accion.C010Id
            )
        ).scalars()
    )
    assert len(links) == 1  # SOLO la relevante quedo vinculada
    assert links[0].Relevancia is not None and links[0].Relevancia >= 70
    # La noticia Fed (valor global) se guardo en C060 SIN vinculo C061.
    all_rows = list(db_session.execute(select(Noticia)).scalars())
    fed_rows = [n for n in all_rows if "Fed fears" in n.Titulo]
    assert len(fed_rows) == 1
    assert all(link.C060Id != fed_rows[0].C060Id for link in links)
    # La de SpaceX (irrelevante y sin valor de mercado) NI se guarda.
    assert not any("SpaceX" in n.Titulo for n in all_rows)


def test_symbol_endpoint_returns_message_when_nothing_relevant(
    client, db_session, monkeypatch, open_accion
):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    provider = _SymbolProvider(
        [
            _item("SpaceX open IPO buzz grows", url="https://news.example.com/sx"),
            _item("Stores open late for holiday rush", url="https://news.example.com/st"),
        ]
    )
    monkeypatch.setattr(news_orchestrator, "_providers", lambda: [provider])

    r = client.get("/api/news/symbol/OPEN?forceRefresh=true", headers=headers)
    assert r.status_code == 200
    assert r.json()["items"] == []  # sin relleno irrelevante
    assert "No highly relevant" in r.json()["message"]


def test_read_time_rescore_filters_stale_bad_links(
    client, db_session, monkeypatch, open_accion
):
    """Vinculos C061 contaminados ANTES del filtro se limpian al leer."""
    from app.repositories.noticias_repository import NoticiasRepository

    repo = NoticiasRepository(db_session)
    bad = repo.upsert_news_item(
        _item("SpaceX open IPO buzz grows", url="https://news.example.com/old-bad")
    )
    repo.link_news_to_action(bad.C060Id, open_accion.C010Id)  # vinculo viejo
    good = repo.upsert_news_item(
        _item(
            "Opendoor Technologies beats revenue estimates",
            url="https://news.example.com/old-good",
        )
    )
    repo.link_news_to_action(good.C060Id, open_accion.C010Id)
    db_session.commit()

    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")
    # Sin refresh (cache fresco): la lectura igual re-puntua y filtra.
    r = client.get("/api/news/symbol/OPEN", headers=headers)
    titles = [i["title"] for i in r.json()["items"]]
    assert any("Opendoor" in t for t in titles)
    assert all("SpaceX" not in t for t in titles)


# ===== Noticias globales: amplitud y ranking =====


def test_global_query_groups_are_broader():
    assert len(GLOBAL_MARKET_QUERIES) >= 8
    assert len(GEOPOLITICAL_MARKET_QUERIES) >= 10
    assert len(FED_MACRO_QUERIES) >= 8
    assert len(SECTOR_QUERIES) >= 6
    assert len(TRENDING_STOCKS_QUERIES) >= 8
    assert "Trump tariffs stock market" in GEOPOLITICAL_MARKET_QUERIES
    assert "Powell speech stocks" in FED_MACRO_QUERIES
    assert "semiconductor stocks news today" in SECTOR_QUERIES
    assert env_settings.NEWS_GLOBAL_MAX_QUERIES_PER_REFRESH >= 30


def test_interleave_covers_all_groups_early():
    """Con el limite de consultas, las primeras N deben cubrir TODOS los
    temas (no solo el primer grupo)."""
    mixed = _interleave(GLOBAL_MARKET_QUERIES, FED_MACRO_QUERIES, SECTOR_QUERIES)
    head = mixed[:6]
    assert any(q in GLOBAL_MARKET_QUERIES for q in head)
    assert any(q in FED_MACRO_QUERIES for q in head)
    assert any(q in SECTOR_QUERIES for q in head)


def test_global_ranking_boosts_quality_and_impact():
    now = datetime(2026, 6, 12, 12, 0)
    same_age = datetime(2026, 6, 12, 10, 0)
    quality_impact = nr.global_rank_score(
        "Stocks rally as Fed signals rate cut",
        None,
        "Reuters",
        "Fed / Rates",
        same_age,
        now,
    )
    generic_blog = nr.global_rank_score(
        "Ten lifestyle tips for the weekend",
        None,
        "Some Blog",
        "Other",
        same_age,
        now,
    )
    assert quality_impact > generic_blog
    # La frescura sigue dominando: algo MUY viejo no gana solo por fuente.
    old_quality = nr.global_rank_score(
        "Stocks rally as Fed signals rate cut",
        None,
        "Reuters",
        "Fed / Rates",
        datetime(2026, 6, 5, 10, 0),
        now,
    )
    fresh_generic = nr.global_rank_score(
        "Company news roundup", None, "Some Blog", "Other", same_age, now
    )
    assert fresh_generic > old_quality


def test_global_endpoint_ranks_market_impact_first(client, db_session, monkeypatch):
    make_user(db_session, "Ana", "ana@example.com")
    headers = login_headers(client, "Ana")

    same_dt = datetime(2026, 6, 12, 10, 0)

    def _aggregate(db, repo):
        for title, url, publisher in (
            ("Ten lifestyle tips for the weekend", "https://x.com/blog", "Some Blog"),
            ("Stocks rally as Fed signals rate cut", "https://x.com/fed", "Reuters"),
        ):
            repo.upsert_news_item(
                NewsItem(
                    title=title,
                    url=url,
                    provider="GOOGLE_NEWS",
                    publisher=publisher,
                    publishedAt=same_dt,
                    category=classify_category(title),
                )
            )
        return (["FAKE"], [])

    monkeypatch.setattr(news_orchestrator, "_aggregate_global_sources", _aggregate)
    # Misma fecha de publicacion para ambos: deciden los boosts de fuente,
    # keywords de impacto y categoria (no la frescura).
    r = client.get("/api/news/global?forceRefresh=true", headers=headers)
    titles = [i["title"] for i in r.json()["items"]]
    assert titles[0] == "Stocks rally as Fed signals rate cut"