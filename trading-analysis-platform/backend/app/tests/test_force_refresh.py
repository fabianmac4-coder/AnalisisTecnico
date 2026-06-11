"""Tests del parametro forceRefresh (bypass del cache de mercado)."""
from __future__ import annotations

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.market import QuoteResponse
from app.security.dependencies import get_current_active_user
from app.services import yahoo_service
from app.services.cache_service import make_quote_key

client = TestClient(app)


class _FakeUser:
    C005Id = 999
    NombreUsuario = "tester"
    Activo = True
    EsAdmin = False


@pytest.fixture(autouse=True)
def _setup(monkeypatch):
    app.dependency_overrides[get_current_active_user] = lambda: _FakeUser()
    yahoo_service.clear_cache()
    monkeypatch.setattr(yahoo_service, "_resolve_meta", lambda s: ("USD", "UTC"))
    yield
    yahoo_service.clear_cache()
    app.dependency_overrides.pop(get_current_active_user, None)


def _df(close: float) -> pd.DataFrame:
    idx = pd.to_datetime(["2026-06-09", "2026-06-10", "2026-06-11"], utc=True)
    return pd.DataFrame(
        {
            "Open": [close - 2, close - 1, close - 0.5],
            "High": [close, close + 1, close + 1],
            "Low": [close - 3, close - 2, close - 1],
            "Close": [close - 1, close - 0.5, close],
            "Volume": [1_000_000, 1_100_000, 1_200_000],
        },
        index=idx,
    )


def test_ohlcv_force_refresh_bypasses_cache(monkeypatch):
    monkeypatch.setattr(yahoo_service, "_download", lambda s, p: _df(100.0))
    r1 = client.get("/api/market/ohlcv?symbol=AAPL&preset=1Y_1D")
    assert r1.status_code == 200
    assert r1.json()["bars"][-1]["close"] == 100.0

    # El proveedor ahora devuelve datos nuevos, pero el cache sigue vivo.
    monkeypatch.setattr(yahoo_service, "_download", lambda s, p: _df(200.0))
    r2 = client.get("/api/market/ohlcv?symbol=AAPL&preset=1Y_1D")
    assert r2.json()["bars"][-1]["close"] == 100.0  # cacheado

    # forceRefresh ignora el cache y trae lo fresco (y lo re-cachea).
    r3 = client.get("/api/market/ohlcv?symbol=AAPL&preset=1Y_1D&forceRefresh=true")
    assert r3.status_code == 200
    assert r3.json()["bars"][-1]["close"] == 200.0
    r4 = client.get("/api/market/ohlcv?symbol=AAPL&preset=1Y_1D")
    assert r4.json()["bars"][-1]["close"] == 200.0  # el fresco quedo cacheado


def test_quote_force_refresh_bypasses_cache(monkeypatch):
    # Pre-siembra el cache de cotizacion con un precio viejo.
    stale = QuoteResponse(
        symbol="AAPL", price=111.0, source="cache", timestamp=0
    )
    yahoo_service._quote_cache.set(make_quote_key("AAPL"), stale)

    class _FastInfo:
        last_price = 222.0
        previous_close = 220.0
        currency = "USD"

    class _FakeTicker:
        def __init__(self, symbol):
            self.fast_info = _FastInfo()
            self.info = {"marketState": "REGULAR"}

    monkeypatch.setattr("yfinance.Ticker", _FakeTicker)

    r1 = client.get("/api/market/quote?symbol=AAPL")
    assert r1.status_code == 200
    assert r1.json()["price"] == 111.0  # cacheado

    r2 = client.get("/api/market/quote?symbol=AAPL&forceRefresh=true")
    assert r2.status_code == 200
    assert r2.json()["price"] == 222.0  # fresco


def test_force_refresh_default_false_keeps_existing_behavior(monkeypatch):
    monkeypatch.setattr(yahoo_service, "_download", lambda s, p: _df(100.0))
    calls = {"n": 0}
    original = yahoo_service._download

    def counting(s, p):
        calls["n"] += 1
        return original(s, p)

    monkeypatch.setattr(yahoo_service, "_download", counting)
    client.get("/api/market/ohlcv?symbol=MSFT&preset=1Y_1D")
    client.get("/api/market/ohlcv?symbol=MSFT&preset=1Y_1D")
    assert calls["n"] == 1  # la segunda salio del cache, como siempre


def test_force_refresh_provider_failure_returns_clean_error(monkeypatch):
    def boom(s, p):
        raise yahoo_service.MarketDataError("proveedor caido")

    monkeypatch.setattr(yahoo_service, "_download", boom)
    r = client.get("/api/market/ohlcv?symbol=FAIL&preset=1Y_1D&forceRefresh=true")
    assert r.status_code == 502
    assert "proveedor" in r.json()["detail"].lower()
