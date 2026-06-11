"""Sanidad matemática de macd() y bollinger() (usados en contexto de IA)."""
from __future__ import annotations

from app.services.indicator_service import bollinger, ema, macd, sma


def test_macd_line_is_ema_fast_minus_ema_slow():
    closes = [float(100 + i + (i % 7)) for i in range(120)]
    line, signal, hist = macd(closes, 12, 26, 9)
    ema12 = ema(closes, 12)
    ema26 = ema(closes, 26)
    assert line[-1] is not None and signal[-1] is not None and hist[-1] is not None
    assert abs(line[-1] - (ema12[-1] - ema26[-1])) < 1e-9
    assert abs(hist[-1] - (line[-1] - signal[-1])) < 1e-9


def test_bollinger_bands_symmetric_around_sma():
    closes = [float(50 + (i % 10)) for i in range(60)]
    upper, middle, lower = bollinger(closes, 20, 2.0)
    sma20 = sma(closes, 20)
    assert middle[-1] == sma20[-1]
    assert upper[-1] is not None and lower[-1] is not None
    # Simetria: media exactamente al centro de las bandas.
    assert abs((upper[-1] + lower[-1]) / 2 - middle[-1]) < 1e-9
    assert upper[-1] > middle[-1] > lower[-1]


def test_bollinger_constant_series_has_zero_width():
    closes = [100.0] * 30
    upper, middle, lower = bollinger(closes, 20, 2.0)
    assert upper[-1] == middle[-1] == lower[-1] == 100.0
