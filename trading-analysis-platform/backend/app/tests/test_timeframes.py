"""Pruebas de los presets de temporalidad y su resolucion a yfinance."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.timeframes import (
    PRESETS_BY_KEY,
    TIMEFRAME_PRESETS,
    get_preset,
    resolve_yahoo_query,
)

EXPECTED_KEYS = ["4Y_1W", "1Y_1D", "6M_1D", "3M_1D", "1M_1H", "1W_30M"]


def test_exactly_six_presets_in_order():
    assert [p.key for p in TIMEFRAME_PRESETS] == EXPECTED_KEYS


def test_4y_is_weekly_not_daily():
    assert get_preset("4Y_1W").interval == "1wk"
    assert "4Y_1D" not in PRESETS_BY_KEY


def test_intervals_match_spec():
    assert get_preset("4Y_1W").interval == "1wk"
    assert get_preset("1Y_1D").interval == "1d"
    assert get_preset("6M_1D").interval == "1d"
    assert get_preset("3M_1D").interval == "1d"
    assert get_preset("1M_1H").interval == "1h"
    assert get_preset("1W_30M").interval == "30m"


def test_get_preset_unknown_raises():
    with pytest.raises(KeyError):
        get_preset("NOPE")


def test_resolve_period_based_presets():
    q = resolve_yahoo_query(PRESETS_BY_KEY["1Y_1D"])
    assert q.period == "1y"
    assert q.start is None and q.end is None


def test_resolve_4y_uses_start_end():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    q = resolve_yahoo_query(PRESETS_BY_KEY["4Y_1W"], now=now)
    assert q.period is None
    assert q.interval == "1wk"
    assert q.start is not None and q.end == now
    # ~4 anios atras.
    assert (now - q.start).days >= 365 * 4 - 2


def test_resolve_1w_uses_seven_days():
    now = datetime(2026, 1, 8, tzinfo=timezone.utc)
    q = resolve_yahoo_query(PRESETS_BY_KEY["1W_30M"], now=now)
    assert (now - q.start).days == 7
    assert q.interval == "30m"
