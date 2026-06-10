"""Definicion centralizada de las temporalidades (presets).

Este modulo es el equivalente backend del archivo `utils/timeframes.ts` del
frontend. Ambos lados deben permanecer alineados: misma `key`, mismo `interval`
y la misma intencion de rango. Aqui ademas resolvemos los argumentos concretos
que se le pasan a yfinance (period vs start/end).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional


@dataclass(frozen=True)
class TimeframePreset:
    key: str
    label: str
    interval: str
    chart_interval_label: str
    intraday: bool
    # Cuando se usa period (ej. "1y") en vez de start/end.
    period: Optional[str] = None
    # Cuando el rango se calcula con start/end relativo a "ahora".
    lookback_days: Optional[int] = None
    # Cuando el rango se mide en años (start/end).
    lookback_years: Optional[int] = None


# Orden = orden en el que se muestran las seis graficas en el dashboard.
TIMEFRAME_PRESETS: list[TimeframePreset] = [
    TimeframePreset(
        key="4Y_1W",
        label="4 anios / Semanal",
        interval="1wk",
        chart_interval_label="1W",
        intraday=False,
        lookback_years=4,
    ),
    TimeframePreset(
        key="1Y_1D",
        label="1 anio / Diario",
        interval="1d",
        chart_interval_label="1D",
        intraday=False,
        period="1y",
    ),
    TimeframePreset(
        key="6M_1D",
        label="6 meses / Diario",
        interval="1d",
        chart_interval_label="1D",
        intraday=False,
        period="6mo",
    ),
    TimeframePreset(
        key="3M_1D",
        label="3 meses / Diario",
        interval="1d",
        chart_interval_label="1D",
        intraday=False,
        period="3mo",
    ),
    TimeframePreset(
        key="1M_1H",
        label="1 mes / 1 hora",
        interval="1h",
        chart_interval_label="60",
        intraday=True,
        period="1mo",
    ),
    TimeframePreset(
        key="1W_30M",
        label="1 semana / 30 minutos",
        interval="30m",
        chart_interval_label="30",
        intraday=True,
        lookback_days=7,
    ),
]

PRESETS_BY_KEY: dict[str, TimeframePreset] = {p.key: p for p in TIMEFRAME_PRESETS}


def get_preset(key: str) -> TimeframePreset:
    preset = PRESETS_BY_KEY.get(key)
    if preset is None:
        raise KeyError(key)
    return preset


@dataclass(frozen=True)
class YahooQuery:
    """Argumentos resueltos para una llamada a yfinance."""

    interval: str
    period: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None


def resolve_yahoo_query(preset: TimeframePreset, now: Optional[datetime] = None) -> YahooQuery:
    """Traduce un preset a los argumentos exactos de yfinance.

    - period: se pasa tal cual (ej. "1y").
    - lookback_years / lookback_days: se calculan start/end relativos a `now`.
    """
    now = now or datetime.now(timezone.utc)

    if preset.period is not None:
        return YahooQuery(interval=preset.interval, period=preset.period)

    if preset.lookback_years is not None:
        start = now - timedelta(days=365 * preset.lookback_years)
        return YahooQuery(interval=preset.interval, start=start, end=now)

    if preset.lookback_days is not None:
        start = now - timedelta(days=preset.lookback_days)
        return YahooQuery(interval=preset.interval, start=start, end=now)

    # Fallback defensivo: nunca deberia pasar si los presets estan bien definidos.
    return YahooQuery(interval=preset.interval, period="1y")


# Duracion "visible" de cada preset en dias de calendario (aprox). Se usa para
# separar las velas visibles de las velas de "warmup" para indicadores.
_PERIOD_DAYS = {"1y": 365, "6mo": 182, "3mo": 91, "1mo": 30}


def preset_visible_span_days(preset: TimeframePreset) -> int:
    if preset.period is not None:
        return _PERIOD_DAYS.get(preset.period, 365)
    if preset.lookback_years is not None:
        return 365 * preset.lookback_years
    if preset.lookback_days is not None:
        return preset.lookback_days
    return 365
