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
