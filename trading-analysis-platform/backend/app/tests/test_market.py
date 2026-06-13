"""Pruebas de normalizacion OHLCV y endpoints de mercado (con yfinance mockeado)."""
from __future__ import annotations

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.security.dependencies import get_current_active_user
from app.services import yahoo_service
from app.services.cache_service import make_market_key, make_quote_key
from app.services.yahoo_service import normalize_ohlcv, normalize_ohlcv_dataframe

client = TestClient(app)


class _FakeUser:
    C005Id = 999
    NombreUsuario = "tester"
    Activo = True
    EsAdmin = False


@pytest.fixture(autouse=True)
def _bypass_auth():
    """Los endpoints de mercado ahora requieren login: stub para estos tests."""
    app.dependency_overrides[get_current_active_user] = lambda: _FakeUser()
    yield
    app.dependency_overrides.pop(get_current_active_user, None)


def _make_df() -> pd.DataFrame:
    idx = pd.to_datetime(["2024-06-03", "2024-06-04", "2024-06-05"], utc=True)
    return pd.DataFrame(
        {
            "Open": [190.1, 191.0, 192.5],
            "High": [192.0, 193.0, 194.0],
            "Low": [188.5, 190.0, 191.0],
            "Close": [191.2, 192.8, 193.5],
            "Volume": [52100000, 48000000, 51000000],
        },
        index=idx,
    )


def test_normalize_basic():
    bars = normalize_ohlcv(_make_df())
    assert len(bars) == 3
    first = bars[0]
    assert first.time == int(pd.Timestamp("2024-06-03", tz="UTC").timestamp() * 1000)
    assert first.open == 190.1
    assert first.volume == 52100000


def test_normalize_empty_dataframe():
    assert normalize_ohlcv(pd.DataFrame()) == []


def test_normalize_drops_nan_rows():
    df = _make_df()
    df.loc[df.index[1], "Close"] = float("nan")
    bars = normalize_ohlcv(df)
    assert len(bars) == 2  # la fila con NaN se descarta


def test_normalize_handles_multiindex_columns():
    df = _make_df()
    df.columns = pd.MultiIndex.from_product([df.columns, ["AAPL"]])
    bars = normalize_ohlcv(df)
    assert len(bars) == 3
    assert bars[0].open == 190.1


def test_normalize_sorts_by_time():
    df = _make_df().iloc[::-1]  # invertido
    bars = normalize_ohlcv(df)
    times = [b.time for b in bars]
    assert times == sorted(times)


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_ohlcv_invalid_preset():
    res = client.get("/api/market/ohlcv", params={"symbol": "AAPL", "preset": "BAD"})
    assert res.status_code == 400


def test_ohlcv_success_with_mock(monkeypatch):
    yahoo_service.clear_cache()

    def fake_download(symbol, preset):
        return _make_df()

    monkeypatch.setattr(yahoo_service, "_download", fake_download)
    monkeypatch.setattr(yahoo_service, "_resolve_meta", lambda s: ("USD", "America/New_York"))

    res = client.get("/api/market/ohlcv", params={"symbol": "AAPL", "preset": "1Y_1D"})
    assert res.status_code == 200
    body = res.json()
    assert body["symbol"] == "AAPL"
    assert body["preset"] == "1Y_1D"
    assert body["currency"] == "USD"
    assert len(body["bars"]) == 3


def test_ohlcv_symbol_not_found(monkeypatch):
    yahoo_service.clear_cache()
    monkeypatch.setattr(yahoo_service, "_download", lambda s, p: pd.DataFrame())
    res = client.get("/api/market/ohlcv", params={"symbol": "ZZZZ", "preset": "1Y_1D"})
    assert res.status_code == 404


def test_normalize_uses_close_not_adj_close():
    df = _make_df()
    # Adj Close diferente de Close: la normalizacion debe ignorar Adj Close.
    df["Adj Close"] = [1.0, 2.0, 3.0]
    bars = normalize_ohlcv_dataframe(df)
    assert [b.close for b in bars] == [191.2, 192.8, 193.5]


def test_ohlcv_response_declares_raw_price_basis(monkeypatch):
    yahoo_service.clear_cache()
    monkeypatch.setattr(yahoo_service, "_download", lambda s, p: _make_df())
    monkeypatch.setattr(yahoo_service, "_resolve_meta", lambda s: ("USD", "America/New_York"))
    res = client.get("/api/market/ohlcv", params={"symbol": "AAPL", "preset": "1Y_1D"})
    assert res.status_code == 200
    assert res.json()["priceBasis"] == "raw"


def test_ohlcv_cache_keys_differ_across_presets():
    k1 = make_market_key("AAPL", "1Y_1D", "1d", "raw")
    k6 = make_market_key("AAPL", "6M_1D", "1d", "raw")
    k_intraday = make_market_key("AAPL", "1M_1H", "1h", "raw")
    assert k1 != k6  # 6M no reutiliza 1Y
    assert k1 != k_intraday  # diario != intradiario
    assert k1 == "ohlcv:AAPL:1Y_1D:1d:raw"
    assert make_quote_key("aapl") == "quote:AAPL"


class _FakeFastInfo:
    last_price = 123.45
    previous_close = 122.10
    currency = "USD"


class _FakeTicker:
    def __init__(self, symbol):
        self.symbol = symbol

    @property
    def fast_info(self):
        return _FakeFastInfo()

    @property
    def info(self):
        return {"marketState": "REGULAR"}


def test_quote_endpoint_canonical_shape(monkeypatch):
    yahoo_service.clear_cache()
    import yfinance as yf

    monkeypatch.setattr(yf, "Ticker", _FakeTicker)
    res = client.get("/api/market/quote", params={"symbol": "AAPL"})
    assert res.status_code == 200
    body = res.json()
    assert body["symbol"] == "AAPL"
    assert body["price"] == 123.45
    assert body["previousClose"] == 122.10
    assert round(body["change"], 2) == 1.35
    assert body["currency"] == "USD"
    assert body["source"] == "yfinance"
    assert isinstance(body["timestamp"], int)


def test_quote_not_found(monkeypatch):
    yahoo_service.clear_cache()

    class _Empty:
        def __init__(self, s):
            pass

        @property
        def fast_info(self):
            class _F:
                last_price = None
                previous_close = None
                currency = None

            return _F()

        @property
        def info(self):
            return {}

        def history(self, **kwargs):
            return pd.DataFrame()

    import yfinance as yf

    monkeypatch.setattr(yf, "Ticker", _Empty)
    res = client.get("/api/market/quote", params={"symbol": "ZZZZ"})
    assert res.status_code == 404


def test_normalize_alias_is_same_function():
    assert normalize_ohlcv is normalize_ohlcv_dataframe


def _make_long_df() -> pd.DataFrame:
    # 6 dias: los 3 primeros seran warmup, los 3 ultimos visibles.
    idx = pd.to_datetime(
        ["2024-05-29", "2024-05-30", "2024-05-31", "2024-06-03", "2024-06-04", "2024-06-05"],
        utc=True,
    )
    n = len(idx)
    return pd.DataFrame(
        {
            "Open": [100.0 + i for i in range(n)],
            "High": [101.0 + i for i in range(n)],
            "Low": [99.0 + i for i in range(n)],
            "Close": [100.5 + i for i in range(n)],
            "Volume": [1000] * n,
        },
        index=idx,
    )


def test_ohlcv_warmup_split(monkeypatch):
    yahoo_service.clear_cache()
    cutoff_ms = int(pd.Timestamp("2024-06-01", tz="UTC").timestamp() * 1000)
    monkeypatch.setattr(
        yahoo_service, "_download_with_warmup", lambda s, p, w: (_make_long_df(), cutoff_ms)
    )
    monkeypatch.setattr(yahoo_service, "_resolve_meta", lambda s: ("USD", None))

    res = client.get(
        "/api/market/ohlcv",
        params={"symbol": "AAPL", "preset": "1Y_1D", "includeWarmup": "true", "warmupBars": 200},
    )
    assert res.status_code == 200
    body = res.json()
    # Visibles y warmup separados por el corte.
    assert body["visibleFrom"] == cutoff_ms
    assert len(body["warmupBars"]) == 3
    assert len(body["bars"]) == 3
    assert all(b["time"] < cutoff_ms for b in body["warmupBars"])
    assert all(b["time"] >= cutoff_ms for b in body["bars"])
    assert body["priceBasis"] == "raw"


def test_warmup_cache_key_is_distinct():
    base = make_market_key("AAPL", "1Y_1D", "1d", "raw")
    warm = make_market_key("AAPL", "1Y_1D", "1d", "raw", warmup_bars=260)
    assert base != warm
    assert base == "ohlcv:AAPL:1Y_1D:1d:raw"  # sin warmup, clave intacta
    assert warm.endswith(":w260")


# --------------------------------------------------------------------------
# Endpoint /market/candles: range/interval dinamicos (workspaces de analisis).
# --------------------------------------------------------------------------
def test_candles_dynamic_range_interval(monkeypatch):
    yahoo_service.clear_cache()
    monkeypatch.setattr(
        yahoo_service, "_download_candles", lambda s, q: _make_df()
    )
    monkeypatch.setattr(yahoo_service, "_resolve_meta", lambda s: ("USD", None))
    res = client.get(
        "/api/market/candles",
        params={"symbol": "AAPL", "range": "1Y", "interval": "1d"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["symbol"] == "AAPL"
    assert body["preset"] == "1Y_1d"  # contextKey = range_interval
    assert body["interval"] == "1d"
    assert body["priceBasis"] == "raw"
    assert len(body["bars"]) == 3


def test_candles_unsupported_combo_returns_422(monkeypatch):
    yahoo_service.clear_cache()
    # 5Y con velas de 1 minuto: no disponible -> 422 con intervalos validos.
    res = client.get(
        "/api/market/candles",
        params={"symbol": "AAPL", "range": "5Y", "interval": "1m"},
    )
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["error"] == "UNSUPPORTED_RANGE_INTERVAL"
    assert detail["range"] == "5Y"
    assert detail["interval"] == "1m"
    assert detail["availableIntervals"] == ["1mo", "1wk", "1d"]


def test_candles_invalid_range_returns_422():
    res = client.get(
        "/api/market/candles",
        params={"symbol": "AAPL", "range": "10Y", "interval": "1d"},
    )
    assert res.status_code == 422


def test_candles_symbol_not_found(monkeypatch):
    yahoo_service.clear_cache()
    monkeypatch.setattr(
        yahoo_service, "_download_candles", lambda s, q: pd.DataFrame()
    )
    res = client.get(
        "/api/market/candles",
        params={"symbol": "ZZZZ", "range": "1Y", "interval": "1d"},
    )
    assert res.status_code == 404


def test_candles_warmup_split(monkeypatch):
    yahoo_service.clear_cache()
    cutoff_ms = int(pd.Timestamp("2024-06-01", tz="UTC").timestamp() * 1000)
    monkeypatch.setattr(
        yahoo_service,
        "_download_candles_with_warmup",
        lambda s, interval, days, w: (_make_long_df(), cutoff_ms),
    )
    monkeypatch.setattr(yahoo_service, "_resolve_meta", lambda s: ("USD", None))
    res = client.get(
        "/api/market/candles",
        params={
            "symbol": "AAPL",
            "range": "1Y",
            "interval": "1d",
            "includeWarmup": "true",
            "warmupBars": 200,
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["visibleFrom"] == cutoff_ms
    assert len(body["warmupBars"]) == 3
    assert len(body["bars"]) == 3
    assert all(b["time"] < cutoff_ms for b in body["warmupBars"])


def test_ranges_endpoint_lists_options():
    res = client.get("/api/market/ranges")
    assert res.status_code == 200
    body = res.json()
    assert "5Y" in body["ranges"]
    assert "1m" in body["intervals"]
