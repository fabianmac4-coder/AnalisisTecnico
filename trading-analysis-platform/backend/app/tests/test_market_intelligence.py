"""Tests de Inteligencia de Mercado + Sentimiento (Fase 2).

Sin red: se mockean yahoo_service, market_movers_service y news_service.
"""
from __future__ import annotations

import json

import pytest

from app.models import MarketCache
from app.repositories.market_cache_repository import MarketCacheRepository
from app.schemas.market import Candle, OHLCVResponse, QuoteResponse
from app.services import market_intelligence_service as mi
from app.services import stock_scorecard_service as scorecard
from app.services import yahoo_service
from app.services.market_movers import market_movers_service as mm_service
from app.services.news import news_service
from app.services.sentiment import sentiment_service
from app.services.sentiment.internal_market_sentiment_provider import (
    InternalMarketSentimentProvider,
)
from app.services.sentiment.sentiment_types import IndexTrendInput, SentimentInputs
from app.tests.conftest import login_headers, make_user


# --------------------------------------------------------------------------
# Fakes
# --------------------------------------------------------------------------
def fake_quote(symbol: str, price: float = 100.0, change: float = 1.0,
               change_pct: float = 0.8) -> QuoteResponse:
    return QuoteResponse(
        symbol=symbol, price=price, previousClose=price - change, change=change,
        changePercent=change_pct, currency="USD", marketState="REGULAR",
        source="test", timestamp=0,
    )


def fake_ohlcv(symbol: str) -> OHLCVResponse:
    bars = [
        Candle(time=1700000000000 + i * 86400000, open=99, high=101, low=98,
               close=100 + i * 0.1)
        for i in range(30)
    ]
    return OHLCVResponse(symbol=symbol, preset="3M_1D", interval="1d", bars=bars)


def fake_movers(db, limit=25, force_refresh=False) -> dict:
    return {
        "trending": {"lastUpdated": None, "items": [
            {"symbol": "NVDA", "changePercent": 5.0, "volume": 1000}]},
        "topGainers": {"lastUpdated": None, "items": [
            {"symbol": "NVDA", "name": "Nvidia", "changePercent": 5.0}]},
        "topLosers": {"lastUpdated": None, "items": [
            {"symbol": "INTC", "name": "Intel", "changePercent": -3.0}]},
        "mostActive": {"lastUpdated": None, "items": [
            {"symbol": "AAPL", "changePercent": 1.0, "volume": 9000},
            {"symbol": "TSLA", "changePercent": -0.5, "volume": 8000}]},
        "warnings": [],
    }


def fake_news(db, **kwargs) -> dict:
    return {
        "items": [{
            "id": 1, "title": "Stocks rally as Fed signals rate cut",
            "publisher": "Reuters", "provider": "YAHOO", "category": "Markets",
            "url": "http://example.com/a", "publishedAt": None,
            "relevanceReason": None,
        }],
        "lastUpdated": None, "fromCache": False, "warnings": [],
    }


@pytest.fixture
def patch_market(monkeypatch):
    def _quote(symbol, force_refresh=False):
        if symbol == "^VIX":
            return fake_quote(symbol, price=14.0, change=-0.2, change_pct=-1.0)
        return fake_quote(symbol)
    monkeypatch.setattr(yahoo_service, "get_quote", _quote)
    monkeypatch.setattr(yahoo_service, "get_ohlcv", lambda s, preset, **k: fake_ohlcv(s))
    monkeypatch.setattr(mm_service, "get_all_lists", fake_movers)
    monkeypatch.setattr(news_service, "get_global_news", fake_news)
    return monkeypatch


def _auth(client, db_session, name="Ana", email="ana@example.com"):
    make_user(db_session, name, email)
    return login_headers(client, name)


# --------------------------------------------------------------------------
# Auth + estructura
# --------------------------------------------------------------------------
def test_overview_requires_auth(client):
    assert client.get("/api/market-intelligence/overview").status_code == 401


def test_sentiment_requires_auth(client):
    assert client.get("/api/market-intelligence/sentiment").status_code == 401


def test_overview_returns_indices_and_sentiment(client, db_session, patch_market):
    headers = _auth(client, db_session)
    res = client.get("/api/market-intelligence/overview", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert "indices" in body and len(body["indices"]) >= 1
    assert any(i["symbol"] == "^GSPC" for i in body["indices"])
    assert "sentiment" in body and body["sentiment"]["score"] is not None
    assert "fearGreed" in body
    assert "marketMoversSummary" in body
    assert "topNews" in body and len(body["topNews"]) == 1
    assert isinstance(body["whatThisMeans"], list) and body["whatThisMeans"]


# --------------------------------------------------------------------------
# Sentimiento parcial / VIX ausente
# --------------------------------------------------------------------------
def test_sentiment_works_with_partial_components():
    prov = InternalMarketSentimentProvider()
    res = prov.compute(SentimentInputs(
        sp500=IndexTrendInput("^GSPC", "S&P 500", change_percent=0.9,
                              last_close=100, short_avg=95),
        gainers_count=30, losers_count=10,
    ))
    assert res.score is not None
    assert res.label in ("GREED", "EXTREME_GREED", "NEUTRAL")
    # Sin VIX la confianza no puede ser HIGH.
    assert res.confidence in ("LOW", "MEDIUM")


def test_missing_vix_does_not_crash_sentiment(client, db_session, monkeypatch):
    headers = _auth(client, db_session)

    def _quote(symbol, force_refresh=False):
        if symbol == "^VIX":
            raise RuntimeError("VIX down")
        return fake_quote(symbol)
    monkeypatch.setattr(yahoo_service, "get_quote", _quote)
    monkeypatch.setattr(yahoo_service, "get_ohlcv", lambda s, preset, **k: fake_ohlcv(s))
    res = client.get("/api/market-intelligence/sentiment", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    # Hay S&P/NASDAQ/Russell aunque falte VIX.
    assert body["score"] is not None
    assert all(c["name"] != "VIX" for c in body["components"])


def test_sentiment_unavailable_when_everything_fails(client, db_session, monkeypatch):
    headers = _auth(client, db_session)
    monkeypatch.setattr(yahoo_service, "get_quote",
                        lambda s, force_refresh=False: (_ for _ in ()).throw(RuntimeError()))
    monkeypatch.setattr(yahoo_service, "get_ohlcv",
                        lambda s, preset, **k: (_ for _ in ()).throw(RuntimeError()))
    res = client.get("/api/market-intelligence/sentiment", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["score"] is None
    assert body["label"] == "UNAVAILABLE"
    assert body["warnings"]


# --------------------------------------------------------------------------
# Cache C080
# --------------------------------------------------------------------------
def test_overview_is_cached_in_c080(client, db_session, patch_market):
    headers = _auth(client, db_session)
    client.get("/api/market-intelligence/overview", headers=headers)
    rows = db_session.query(MarketCache).filter(
        MarketCache.TipoDato == "MARKET_INTELLIGENCE_OVERVIEW").all()
    assert len(rows) >= 1
    cached = MarketCacheRepository(db_session).get_fresh(
        "MARKET_INTELLIGENCE_OVERVIEW", "global")
    assert cached is not None and "indices" in cached


def test_second_call_served_from_cache(client, db_session, patch_market):
    headers = _auth(client, db_session)
    first = client.get("/api/market-intelligence/overview", headers=headers).json()
    assert first["fromCache"] is False
    second = client.get("/api/market-intelligence/overview", headers=headers).json()
    assert second["fromCache"] is True


def test_force_refresh_bypasses_cache(client, db_session, patch_market):
    headers = _auth(client, db_session)
    client.get("/api/market-intelligence/overview", headers=headers)
    forced = client.get(
        "/api/market-intelligence/overview?forceRefresh=true", headers=headers).json()
    assert forced["fromCache"] is False


def test_provider_failure_returns_cached_data(client, db_session, patch_market, monkeypatch):
    headers = _auth(client, db_session)
    # 1. Primer GET cachea datos buenos.
    good = client.get("/api/market-intelligence/overview", headers=headers).json()
    assert good["indices"]
    # 2. Todos los proveedores fallan; forceRefresh debe caer al cache viejo.
    monkeypatch.setattr(yahoo_service, "get_quote",
                        lambda s, force_refresh=False: (_ for _ in ()).throw(RuntimeError()))
    monkeypatch.setattr(yahoo_service, "get_ohlcv",
                        lambda s, preset, **k: (_ for _ in ()).throw(RuntimeError()))
    monkeypatch.setattr(mm_service, "get_all_lists",
                        lambda db, limit=25, force_refresh=False: (_ for _ in ()).throw(RuntimeError()))
    monkeypatch.setattr(news_service, "get_global_news",
                        lambda db, **k: (_ for _ in ()).throw(RuntimeError()))
    stale = client.get(
        "/api/market-intelligence/overview?forceRefresh=true", headers=headers).json()
    assert stale["indices"]  # datos del cache viejo
    assert any("cached" in w.lower() for w in stale["warnings"])


def test_provider_failure_without_cache_returns_partial(client, db_session, monkeypatch):
    headers = _auth(client, db_session)
    monkeypatch.setattr(yahoo_service, "get_quote",
                        lambda s, force_refresh=False: (_ for _ in ()).throw(RuntimeError()))
    monkeypatch.setattr(yahoo_service, "get_ohlcv",
                        lambda s, preset, **k: (_ for _ in ()).throw(RuntimeError()))
    monkeypatch.setattr(mm_service, "get_all_lists",
                        lambda db, limit=25, force_refresh=False: (_ for _ in ()).throw(RuntimeError()))
    monkeypatch.setattr(news_service, "get_global_news",
                        lambda db, **k: (_ for _ in ()).throw(RuntimeError()))
    res = client.get("/api/market-intelligence/overview", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["indices"] == []
    assert body["warnings"]


# --------------------------------------------------------------------------
# Integración Scorecard + seguridad
# --------------------------------------------------------------------------
def test_scorecard_sentiment_reports_source(monkeypatch):
    monkeypatch.setattr(yahoo_service, "get_quote",
                        lambda s, force_refresh=False: fake_quote(
                            s, price=14.0 if s == "^VIX" else 100.0))
    out = scorecard._score_sentiment({"vixLowRiskMax": 16})
    assert out["score"] is not None
    assert out["source"] == "internal_market_sentiment_provider"


def test_overview_exposes_no_sensitive_data(client, db_session, patch_market):
    headers = _auth(client, db_session)
    raw = client.get("/api/market-intelligence/overview", headers=headers).text
    lowered = raw.lower()
    for secret in ("passwordhash", "accesstoken", "jwt_secret", "password_hash"):
        assert secret not in lowered
