"""Cache simple en memoria con TTL.

Pensado para cachear respuestas de mercado por symbol+preset. No usa
dependencias externas; es suficiente para una app personal de un solo proceso.
"""
from __future__ import annotations

import threading
import time
from typing import Any, Optional


class TTLCache:
    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if now >= expires_at:
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._store[key] = (time.time() + self._ttl, value)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


def make_market_key(
    symbol: str,
    preset: str,
    interval: str,
    price_basis: str = "raw",
    warmup_bars: int = 0,
) -> str:
    # Clave rica: evita colisiones entre presets, intervalos, bases de precio
    # y respuestas con/sin warmup. Ej: ohlcv:AAPL:1Y_1D:1d:raw[:w260]
    base = f"ohlcv:{symbol.upper()}:{preset}:{interval}:{price_basis}"
    return f"{base}:w{warmup_bars}" if warmup_bars > 0 else base


def make_quote_key(symbol: str) -> str:
    return f"quote:{symbol.upper()}"
