"""Servicio que habla con Yahoo Finance via yfinance.

Responsabilidades:
- Resolver el preset a argumentos de yfinance.
- Descargar el DataFrame y NORMALIZARLO a una lista de velas (dict simples).
- Convertir fechas a Unix milliseconds en UTC.
- Manejar dataframe vacio, ticker invalido y errores de red.
- Cachear por symbol+preset con TTL.

El frontend nunca ve un DataFrame: solo recibe JSON limpio.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import pandas as pd

from app.config import settings
from app.schemas.market import Candle, OHLCVResponse, QuoteResponse
from app.schemas.symbols import SymbolInfo
from app.services.cache_service import TTLCache, make_market_key, make_quote_key
from app.timeframes import TimeframePreset, get_preset, resolve_yahoo_query

# Base de precio: usamos precios crudos (sin ajustar), nunca Adj Close.
PRICE_BASIS = "raw"

# Caches globales separadas (un proceso, uso personal).
_cache = TTLCache(ttl_seconds=settings.cache_ttl_seconds)
_quote_cache = TTLCache(ttl_seconds=settings.quote_cache_ttl_seconds)


class SymbolNotFoundError(Exception):
    """El ticker no existe o no devolvio datos."""


class MarketDataError(Exception):
    """Fallo de red u otro error al consultar Yahoo Finance."""


def _safe_float(value: Any) -> Optional[float]:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def _classify_type(quote_type: str | None) -> str:
    mapping = {
        "EQUITY": "equity",
        "ETF": "etf",
        "INDEX": "index",
        "CRYPTOCURRENCY": "crypto",
        "CURRENCY": "fx",
    }
    if not quote_type:
        return "unknown"
    return mapping.get(quote_type.upper(), "unknown")


def normalize_ohlcv_dataframe(df: pd.DataFrame) -> list[Candle]:
    """Funcion UNICA de normalizacion del DataFrame de yfinance -> velas.

    Reglas (validas para TODOS los presets, un solo camino de codigo):
    - Aplana columnas MultiIndex si aparecen (('Close','AAPL') -> 'Close').
    - Usa columnas crudas Open/High/Low/Close/Volume. NUNCA Adj Close.
    - Descarta filas con OHLC faltante (NaN/Inf).
    - Ordena ascendente por tiempo.
    - Convierte timestamps a Unix milliseconds UTC.
    - Devuelve floats/ints JSON-compatibles (sin tipos pandas/numpy, sin NaN).
    """
    if df is None or df.empty:
        return []

    df = df.copy()

    # yfinance a veces devuelve columnas MultiIndex: ('Close', 'AAPL').
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0] for col in df.columns]

    # Indice -> datetime UTC.
    idx = pd.to_datetime(df.index, utc=True, errors="coerce")

    candles: list[Candle] = []
    for ts, (_, row) in zip(idx, df.iterrows()):
        if pd.isna(ts):
            continue
        o = _safe_float(row.get("Open"))
        h = _safe_float(row.get("High"))
        low = _safe_float(row.get("Low"))
        c = _safe_float(row.get("Close"))
        v = _safe_float(row.get("Volume"))
        # Si falta cualquier OHLC, descartamos la vela (dato corrupto/feriado).
        if None in (o, h, low, c):
            continue
        candles.append(
            Candle(
                time=int(ts.timestamp() * 1000),
                open=o,
                high=h,
                low=low,
                close=c,
                volume=v,
            )
        )

    candles.sort(key=lambda b: b.time)
    return candles


# Alias historico (compatibilidad con el nombre previo).
normalize_ohlcv = normalize_ohlcv_dataframe


# Configuracion consistente para TODA descarga de precios.
# Precios crudos (auto_adjust=False), sin acciones/pre-post, columnas planas.
_BASE_DOWNLOAD_KWARGS: dict[str, Any] = {
    "auto_adjust": False,
    "actions": False,
    "prepost": False,
    "progress": False,
    "group_by": "column",
    "multi_level_index": False,
    "threads": False,
}


def _download(symbol: str, preset: TimeframePreset) -> pd.DataFrame:
    """Descarga el DataFrame crudo desde yfinance con reintentos basicos."""
    import yfinance as yf

    query = resolve_yahoo_query(preset)
    last_err: Exception | None = None

    for _ in range(settings.yahoo_max_retries + 1):
        try:
            kwargs: dict[str, Any] = {
                "tickers": symbol,
                "interval": query.interval,
                **_BASE_DOWNLOAD_KWARGS,
            }
            if query.period is not None:
                kwargs["period"] = query.period
            else:
                kwargs["start"] = query.start
                kwargs["end"] = query.end

            try:
                return yf.download(**kwargs)
            except TypeError:
                # Version de yfinance sin algun kwarg (ej. multi_level_index):
                # reintenta solo con los argumentos esenciales.
                safe = {
                    k: v
                    for k, v in kwargs.items()
                    if k not in ("multi_level_index", "group_by", "actions", "prepost")
                }
                return yf.download(**safe)
        except Exception as exc:  # noqa: BLE001 - normalizamos errores de red
            last_err = exc

    raise MarketDataError(str(last_err) if last_err else "Error desconocido")


# Dias de calendario aproximados por vela, para dimensionar el warmup.
_WARMUP_STEP_DAYS: dict[str, float] = {
    "1mo": 30.0,
    "1wk": 7.0,
    "1d": 1.0,
    "1h": 1 / 7,  # ~7 velas por dia de mercado
    "30m": 1 / 13,  # ~13 velas por dia de mercado
    "15m": 1 / 26,
    "5m": 1 / 78,
    "1m": 1 / 390,
}

# Limites de historico intradiario de yfinance (con margen de seguridad).
_INTRADAY_MAX_DAYS: dict[str, int] = {
    "1h": 700,
    "30m": 55,
    "15m": 55,
    "5m": 55,
    "1m": 7,
}


def _download_with_warmup(
    symbol: str, preset: TimeframePreset, warmup_bars: int
) -> tuple[pd.DataFrame, int]:
    """Descarga visible + warmup en UNA llamada (start extendido hacia atras).

    Devuelve (df, visible_from_ms). Si el limite intradiario de yfinance
    recorta el warmup, se devuelve lo disponible sin fallar.
    """
    from app.timeframes import preset_visible_span_days

    now = datetime.now(timezone.utc)
    visible_days = preset_visible_span_days(preset)
    visible_start = now - timedelta(days=visible_days)

    step = _WARMUP_STEP_DAYS.get(preset.interval, 1.0)
    # Factor 1.6 cubre fines de semana/feriados; +5 dias de colchon.
    warmup_days = int(warmup_bars * step * 1.6) + 5
    start = visible_start - timedelta(days=warmup_days)

    max_days = _INTRADAY_MAX_DAYS.get(preset.interval)
    if max_days is not None:
        earliest = now - timedelta(days=max_days)
        if start < earliest:
            start = earliest  # warmup parcial: mejor algo que fallar

    import yfinance as yf

    last_err: Exception | None = None
    for _ in range(settings.yahoo_max_retries + 1):
        try:
            kwargs: dict[str, Any] = {
                "tickers": symbol,
                "interval": preset.interval,
                "start": start,
                "end": now,
                **_BASE_DOWNLOAD_KWARGS,
            }
            try:
                df = yf.download(**kwargs)
            except TypeError:
                safe = {
                    k: v
                    for k, v in kwargs.items()
                    if k not in ("multi_level_index", "group_by", "actions", "prepost")
                }
                df = yf.download(**safe)
            return df, int(visible_start.timestamp() * 1000)
        except Exception as exc:  # noqa: BLE001
            last_err = exc

    raise MarketDataError(str(last_err) if last_err else "Error desconocido")


def get_ohlcv(
    symbol: str,
    preset_key: str,
    include_warmup: bool = False,
    warmup_bars: int = 0,
    force_refresh: bool = False,
) -> OHLCVResponse:
    """Punto de entrada principal: respuesta normalizada y cacheada.

    Con include_warmup, ademas de las velas visibles del preset se devuelven
    `warmupBars` previas (solo para calculo de indicadores como SMA 200; nunca
    se pintan como candles). El cache distingue ambas variantes.
    force_refresh ignora la LECTURA del cache (el resultado fresco igual se
    cachea) — lo usa el boton/auto-refresh del frontend.
    """
    symbol = symbol.strip().upper()
    if not symbol:
        raise SymbolNotFoundError("symbol vacio")

    try:
        preset = get_preset(preset_key)
    except KeyError as exc:
        raise ValueError(f"Preset desconocido: {preset_key}") from exc

    effective_warmup = warmup_bars if include_warmup else 0
    cache_key = make_market_key(
        symbol, preset_key, preset.interval, PRICE_BASIS, effective_warmup
    )
    if not force_refresh:
        cached = _cache.get(cache_key)
        if cached is not None:
            return cached

    warmup: list = []
    visible_from_ms: int | None = None
    if effective_warmup > 0:
        df, visible_from_ms = _download_with_warmup(symbol, preset, effective_warmup)
        all_bars = normalize_ohlcv_dataframe(df)
        bars = [b for b in all_bars if b.time >= visible_from_ms]
        warmup = [b for b in all_bars if b.time < visible_from_ms]
    else:
        df = _download(symbol, preset)
        bars = normalize_ohlcv_dataframe(df)

    if not bars:
        # Sin datos: puede ser ticker invalido o sin historico para ese rango.
        raise SymbolNotFoundError(f"Sin datos para {symbol} ({preset_key})")

    currency, tz = _resolve_meta(symbol)

    response = OHLCVResponse(
        symbol=symbol,
        preset=preset_key,
        interval=preset.interval,
        priceBasis=PRICE_BASIS,
        currency=currency,
        timezone=tz,
        bars=bars,
        warmupBars=warmup,
        visibleFrom=visible_from_ms if visible_from_ms is not None else bars[0].time,
        visibleTo=bars[-1].time,
    )
    _cache.set(cache_key, response)
    return response


# --------------------------------------------------------------------------
# Candles dinamicos: range + interval arbitrarios (workspaces de analisis).
# Mismo pipeline de normalizacion/cache que los presets, pero la "key" de cache
# es el contextKey f"{range}_{interval}".
# --------------------------------------------------------------------------
def _download_candles(symbol: str, query: "Any") -> pd.DataFrame:
    """Descarga un DataFrame para una CandleQuery (period o start/end)."""
    import yfinance as yf

    last_err: Exception | None = None
    for _ in range(settings.yahoo_max_retries + 1):
        try:
            kwargs: dict[str, Any] = {
                "tickers": symbol,
                "interval": query.interval,
                **_BASE_DOWNLOAD_KWARGS,
            }
            if query.period is not None:
                kwargs["period"] = query.period
            else:
                kwargs["start"] = query.start
                kwargs["end"] = query.end
            try:
                return yf.download(**kwargs)
            except TypeError:
                safe = {
                    k: v
                    for k, v in kwargs.items()
                    if k not in ("multi_level_index", "group_by", "actions", "prepost")
                }
                return yf.download(**safe)
        except Exception as exc:  # noqa: BLE001
            last_err = exc
    raise MarketDataError(str(last_err) if last_err else "Error desconocido")


def _download_candles_with_warmup(
    symbol: str, interval: str, visible_days: int, warmup_bars: int
) -> tuple[pd.DataFrame, int]:
    """Descarga visible + warmup en UNA llamada para un interval arbitrario."""
    now = datetime.now(timezone.utc)
    visible_start = now - timedelta(days=visible_days)

    step = _WARMUP_STEP_DAYS.get(interval, 1.0)
    warmup_days = int(warmup_bars * step * 1.6) + 5
    start = visible_start - timedelta(days=warmup_days)

    max_days = _INTRADAY_MAX_DAYS.get(interval)
    if max_days is not None:
        earliest = now - timedelta(days=max_days)
        if start < earliest:
            start = earliest  # warmup parcial: mejor algo que fallar

    import yfinance as yf

    last_err: Exception | None = None
    for _ in range(settings.yahoo_max_retries + 1):
        try:
            kwargs: dict[str, Any] = {
                "tickers": symbol,
                "interval": interval,
                "start": start,
                "end": now,
                **_BASE_DOWNLOAD_KWARGS,
            }
            try:
                df = yf.download(**kwargs)
            except TypeError:
                safe = {
                    k: v
                    for k, v in kwargs.items()
                    if k not in ("multi_level_index", "group_by", "actions", "prepost")
                }
                df = yf.download(**safe)
            return df, int(visible_start.timestamp() * 1000)
        except Exception as exc:  # noqa: BLE001
            last_err = exc
    raise MarketDataError(str(last_err) if last_err else "Error desconocido")


def get_candles(
    symbol: str,
    range_key: str,
    interval: str,
    include_warmup: bool = False,
    warmup_bars: int = 0,
    force_refresh: bool = False,
) -> OHLCVResponse:
    """OHLCV para un slot con range/interval arbitrarios.

    Valida la combinacion contra los limites de yfinance (UnsupportedRangeInterval
    -> el router responde 400). El campo `preset` lleva el contextKey
    f"{range}_{interval}".
    """
    from app.chart_workspaces import (
        context_key,
        range_visible_span_days,
        resolve_candle_query,
        validate_range_interval,
    )

    symbol = symbol.strip().upper()
    if not symbol:
        raise SymbolNotFoundError("symbol vacio")

    # Lanza UnsupportedRangeInterval (ValueError) si la combinacion no aplica.
    validate_range_interval(range_key, interval)
    ctx_key = context_key(range_key, interval)

    effective_warmup = warmup_bars if include_warmup else 0
    cache_key = make_market_key(
        symbol, ctx_key, interval, PRICE_BASIS, effective_warmup
    )
    if not force_refresh:
        cached = _cache.get(cache_key)
        if cached is not None:
            return cached

    warmup: list = []
    visible_from_ms: int | None = None
    if effective_warmup > 0:
        df, visible_from_ms = _download_candles_with_warmup(
            symbol, interval, range_visible_span_days(range_key), effective_warmup
        )
        all_bars = normalize_ohlcv_dataframe(df)
        bars = [b for b in all_bars if b.time >= visible_from_ms]
        warmup = [b for b in all_bars if b.time < visible_from_ms]
    else:
        df = _download_candles(symbol, resolve_candle_query(range_key, interval))
        bars = normalize_ohlcv_dataframe(df)

    if not bars:
        raise SymbolNotFoundError(f"Sin datos para {symbol} ({ctx_key})")

    currency, tz = _resolve_meta(symbol)
    response = OHLCVResponse(
        symbol=symbol,
        preset=ctx_key,
        interval=interval,
        priceBasis=PRICE_BASIS,
        currency=currency,
        timezone=tz,
        bars=bars,
        warmupBars=warmup,
        visibleFrom=visible_from_ms if visible_from_ms is not None else bars[0].time,
        visibleTo=bars[-1].time,
    )
    _cache.set(cache_key, response)
    return response


def get_quote(symbol: str, force_refresh: bool = False) -> QuoteResponse:
    """Cotizacion canonica del simbolo (fuente unica del precio actual).

    Estrategia (de mas a menos fiable):
    1. fast_info.last_price + previous_close.
    2. info.regularMarketPrice / currentPrice + regularMarketPreviousClose.
    3. ultimo close del historico 1d/1m (o 5d/1m) como ultimo recurso.

    Cache propia con TTL corto (quote:{SYMBOL}), independiente del OHLCV.
    force_refresh ignora la lectura del cache (el resultado igual se cachea).
    """
    symbol = symbol.strip().upper()
    if not symbol:
        raise SymbolNotFoundError("symbol vacio")

    cache_key = make_quote_key(symbol)
    if not force_refresh:
        cached = _quote_cache.get(cache_key)
        if cached is not None:
            return cached

    import yfinance as yf

    ticker = yf.Ticker(symbol)
    price: float | None = None
    prev_close: float | None = None
    currency: str | None = None
    market_state: str | None = None

    # 1) fast_info (rapido y estable).
    try:
        fast = ticker.fast_info
        price = _safe_float(getattr(fast, "last_price", None))
        prev_close = _safe_float(getattr(fast, "previous_close", None))
        currency = getattr(fast, "currency", None)
    except Exception:  # noqa: BLE001
        pass

    # 2) info como respaldo de campos faltantes.
    if price is None or prev_close is None or market_state is None:
        try:
            info = ticker.info
            price = price or _safe_float(
                info.get("regularMarketPrice") or info.get("currentPrice")
            )
            prev_close = prev_close or _safe_float(
                info.get("regularMarketPreviousClose") or info.get("previousClose")
            )
            currency = currency or info.get("currency")
            market_state = info.get("marketState")
        except Exception:  # noqa: BLE001
            pass

    # 3) ultimo recurso: ultimo close de un historico corto.
    if price is None:
        price = _last_close_from_history(ticker)

    if price is None:
        raise SymbolNotFoundError(f"Sin cotizacion para {symbol}")

    change = None
    change_pct = None
    if prev_close not in (None, 0):
        change = price - prev_close
        change_pct = (change / prev_close) * 100

    response = QuoteResponse(
        symbol=symbol,
        price=price,
        previousClose=prev_close,
        change=change,
        changePercent=change_pct,
        currency=currency,
        marketState=market_state,
        source="yfinance",
        timestamp=int(datetime.now(timezone.utc).timestamp() * 1000),
    )
    _quote_cache.set(cache_key, response)
    return response


def _last_close_from_history(ticker: Any) -> float | None:
    """Ultimo close de un historico corto, como respaldo del precio."""
    for period, interval in (("1d", "1m"), ("5d", "1m"), ("5d", "1d")):
        try:
            hist = ticker.history(period=period, interval=interval, auto_adjust=False)
            if hist is not None and not hist.empty and "Close" in hist.columns:
                val = _safe_float(hist["Close"].dropna().iloc[-1])
                if val is not None:
                    return val
        except Exception:  # noqa: BLE001
            continue
    return None


def _resolve_meta(symbol: str) -> tuple[str | None, str | None]:
    """Obtiene currency y timezone de forma tolerante a fallos."""
    try:
        import yfinance as yf

        info = yf.Ticker(symbol).fast_info
        currency = getattr(info, "currency", None)
        tz = getattr(info, "timezone", None)
        return currency, tz
    except Exception:  # noqa: BLE001 - meta es opcional
        return None, None


def search_symbols(query: str) -> list[SymbolInfo]:
    """Busqueda/validacion de simbolos.

    yfinance no expone una busqueda fuzzy estable, asi que validamos el query
    como ticker exacto. Si Yahoo lo reconoce, devolvemos su info; si no, lista
    vacia. Esto cubre el caso de uso (escribir AAPL, TSLA, etc.).
    """
    query = query.strip().upper()
    if not query:
        return []

    try:
        import yfinance as yf

        ticker = yf.Ticker(query)
        fast = ticker.fast_info
        # fast_info lanza o queda vacio si el ticker no existe.
        last_price = getattr(fast, "last_price", None)
        if last_price is None:
            return []

        name: str | None = None
        quote_type: str | None = None
        exchange: str | None = None
        try:
            info = ticker.info  # puede ser costoso/fallar; lo envolvemos
            name = info.get("shortName") or info.get("longName")
            quote_type = info.get("quoteType")
            exchange = info.get("exchange")
        except Exception:  # noqa: BLE001
            pass

        return [
            SymbolInfo(
                symbol=query,
                name=name,
                exchange=exchange,
                currency=getattr(fast, "currency", None),
                type=_classify_type(quote_type),
                provider="yahoo",
            )
        ]
    except Exception:  # noqa: BLE001 - tratamos cualquier fallo como "no encontrado"
        return []


def clear_cache() -> None:
    _cache.clear()
    _quote_cache.clear()
