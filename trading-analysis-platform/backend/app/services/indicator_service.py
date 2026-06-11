"""Calculo de indicadores tecnicos en el backend (opcional/futuro).

El frontend ya calcula sus indicadores para el MVP, pero exponemos funciones
puras aqui para reutilizarlas en endpoints futuros o en pruebas.
"""
from __future__ import annotations

from typing import Sequence


def sma(values: Sequence[float], period: int) -> list[float | None]:
    out: list[float | None] = []
    acc = 0.0
    window: list[float] = []
    for v in values:
        window.append(v)
        acc += v
        if len(window) > period:
            acc -= window.pop(0)
        out.append(acc / period if len(window) == period else None)
    return out


def ema(values: Sequence[float], period: int) -> list[float | None]:
    out: list[float | None] = []
    k = 2 / (period + 1)
    prev: float | None = None
    for i, v in enumerate(values):
        if i + 1 < period:
            out.append(None)
            continue
        if prev is None:
            # Inicializa con SMA del primer bloque.
            seed = sum(values[: period]) / period
            prev = seed
            out.append(seed)
            continue
        prev = v * k + prev * (1 - k)
        out.append(prev)
    return out


def macd(
    values: Sequence[float], fast: int = 12, slow: int = 26, signal_period: int = 9
) -> tuple[list[float | None], list[float | None], list[float | None]]:
    """MACD clasico: (linea, señal, histograma). Requiere fast < slow."""
    ema_fast = ema(values, fast)
    ema_slow = ema(values, slow)
    line: list[float | None] = [
        (f - s) if f is not None and s is not None else None
        for f, s in zip(ema_fast, ema_slow)
    ]
    # La señal es EMA de la linea MACD (solo sobre los valores existentes).
    valid = [v for v in line if v is not None]
    signal_valid = ema(valid, signal_period)
    signal: list[float | None] = [None] * len(line)
    j = 0
    for i, v in enumerate(line):
        if v is not None:
            signal[i] = signal_valid[j]
            j += 1
    hist: list[float | None] = [
        (l - s) if l is not None and s is not None else None
        for l, s in zip(line, signal)
    ]
    return line, signal, hist


def bollinger(
    values: Sequence[float], period: int = 20, std_mult: float = 2.0
) -> tuple[list[float | None], list[float | None], list[float | None]]:
    """Bandas de Bollinger: (superior, media SMA, inferior)."""
    middle = sma(values, period)
    upper: list[float | None] = [None] * len(values)
    lower: list[float | None] = [None] * len(values)
    for i in range(period - 1, len(values)):
        window = values[i - period + 1 : i + 1]
        mean = middle[i]
        if mean is None:
            continue
        variance = sum((v - mean) ** 2 for v in window) / period
        std = variance**0.5
        upper[i] = mean + std_mult * std
        lower[i] = mean - std_mult * std
    return upper, middle, lower


def rsi(values: Sequence[float], period: int = 14) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if len(values) <= period:
        return out
    gains = 0.0
    losses = 0.0
    for i in range(1, period + 1):
        change = values[i] - values[i - 1]
        gains += max(change, 0)
        losses += max(-change, 0)
    avg_gain = gains / period
    avg_loss = losses / period
    rs = avg_gain / avg_loss if avg_loss != 0 else float("inf")
    out[period] = 100 - 100 / (1 + rs)
    for i in range(period + 1, len(values)):
        change = values[i] - values[i - 1]
        gain = max(change, 0)
        loss = max(-change, 0)
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        rs = avg_gain / avg_loss if avg_loss != 0 else float("inf")
        out[i] = 100 - 100 / (1 + rs)
    return out
