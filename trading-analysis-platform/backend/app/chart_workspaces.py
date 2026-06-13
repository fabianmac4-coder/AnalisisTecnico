"""Definicion central de los workspaces de analisis y de los slots de grafica.

Un *workspace* (espacio de analisis) es una fila de dbo.C030 por usuario + accion.
Cada workspace contiene SEIS slots de grafica configurables; cada slot elige un
`range` (periodo visible) y un `interval` (temporalidad de la vela) de forma
independiente.

El `contextKey` de un slot es `f"{range}_{interval}"` (ej. "1Y_1h"). Ese contextKey
es la "temporalidad de origen" que usan dibujos y Channel R/R (C0101.TemporalidadOrigen),
de modo que dos slots con el mismo range/interval comparten dibujos aunque vivan en
workspaces distintos.

Este modulo es el equivalente backend de `frontend/src/features/charts/chartWorkspaceTypes.ts`:
ambos lados deben mantener las MISMAS claves de range/interval.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

# --- Rangos (periodo visible) -------------------------------------------------
# Orden = orden de mayor a menor amplitud (solo informativo).
RANGES: tuple[str, ...] = ("5Y", "1Y", "6M", "3M", "1M", "1W", "1D")

# Dias de calendario (aprox) que abarca cada rango. Se usa para:
# - separar velas visibles de warmup,
# - validar combinaciones contra los limites intradiarios de yfinance.
RANGE_DAYS: dict[str, int] = {
    "5Y": 365 * 5,
    "1Y": 365,
    "6M": 182,
    "3M": 91,
    "1M": 30,
    "1W": 7,
    "1D": 1,
}

# --- Intervalos (temporalidad de la vela) ------------------------------------
INTERVALS: tuple[str, ...] = ("1mo", "1wk", "1d", "1h", "30m", "15m", "5m", "1m")

# Fuente UNICA de verdad de los intervalos disponibles por rango (debe coincidir
# con `frontend/src/features/charts/chartRangeIntervalConfig.ts`). El frontend
# solo muestra estos intervalos; el backend rechaza el resto (422).
AVAILABLE_INTERVALS_BY_RANGE: dict[str, list[str]] = {
    "5Y": ["1mo", "1wk", "1d"],
    "1Y": ["1mo", "1wk", "1d", "1h"],
    "6M": ["1wk", "1d", "1h", "30m", "15m"],
    "3M": ["1wk", "1d", "1h", "30m", "15m"],
    "1M": ["1d", "1h", "30m", "15m", "5m"],
    "1W": ["1h", "30m", "15m", "5m", "1m"],
    "1D": ["30m", "15m", "5m", "1m"],
}

# Intervalo por defecto al cambiar de rango (cuando el actual ya no es valido).
DEFAULT_INTERVAL_BY_RANGE: dict[str, str] = {
    "5Y": "1wk",
    "1Y": "1d",
    "6M": "1d",
    "3M": "1d",
    "1M": "1h",
    "1W": "30m",
    "1D": "5m",
}

# --- Configuracion por defecto de los seis slots -----------------------------
# Reproduce el comportamiento historico (las seis temporalidades fijas), con el
# panel 1 ampliado a 5Y/1wk (antes 4Y).
DEFAULT_CHART_SLOTS: list[dict[str, str]] = [
    {"slotId": "chart_1", "range": "5Y", "interval": "1wk"},
    {"slotId": "chart_2", "range": "1Y", "interval": "1d"},
    {"slotId": "chart_3", "range": "6M", "interval": "1d"},
    {"slotId": "chart_4", "range": "3M", "interval": "1d"},
    {"slotId": "chart_5", "range": "1M", "interval": "1h"},
    {"slotId": "chart_6", "range": "1W", "interval": "30m"},
]

WORKSPACE_CONFIG_VERSION = 3
WORKSPACE_TYPE = "STOCK_ANALYSIS"
DEFAULT_WORKSPACE_NAME = "Default Analysis"


class UnsupportedRangeInterval(ValueError):
    """La combinacion range/interval no esta soportada.

    Lleva `range`, `interval` y `available_intervals` para que el endpoint
    construya una respuesta 422 estructurada.
    """

    def __init__(
        self, message: str, range_key: str, interval: str
    ) -> None:
        super().__init__(message)
        self.range = range_key
        self.interval = interval
        self.available_intervals = AVAILABLE_INTERVALS_BY_RANGE.get(range_key, [])


def context_key(range_key: str, interval: str) -> str:
    return f"{range_key}_{interval}"


def is_valid_range(range_key: str) -> bool:
    return range_key in AVAILABLE_INTERVALS_BY_RANGE


def is_valid_interval(interval: str) -> bool:
    return interval in INTERVALS


def is_supported_combo(range_key: str, interval: str) -> bool:
    return interval in AVAILABLE_INTERVALS_BY_RANGE.get(range_key, [])


def default_interval_for_range(range_key: str) -> str:
    return DEFAULT_INTERVAL_BY_RANGE.get(range_key, "1d")


def validate_range_interval(range_key: str, interval: str) -> None:
    """Valida un par range/interval. Lanza UnsupportedRangeInterval si no aplica."""
    if not is_valid_range(range_key):
        raise UnsupportedRangeInterval(
            f"Rango invalido: {range_key}", range_key, interval
        )
    if not is_supported_combo(range_key, interval):
        raise UnsupportedRangeInterval(
            f"El intervalo {interval} no esta disponible para el rango "
            f"{range_key}.",
            range_key,
            interval,
        )


def normalize_chart_slots(slots: list[dict] | None) -> list[dict[str, str]]:
    """Sanea la lista de slots: ids canonicos chart_1..chart_6 y pares validos.

    - Conserva el orden de entrada.
    - Cae al default por posicion cuando un slot es invalido o falta.
    - Devuelve siempre EXACTAMENTE seis slots.
    """
    result: list[dict[str, str]] = []
    slots = slots or []
    for i in range(6):
        default = DEFAULT_CHART_SLOTS[i]
        slot = slots[i] if i < len(slots) and isinstance(slots[i], dict) else {}
        range_key = str(slot.get("range") or default["range"])
        interval = str(slot.get("interval") or default["interval"])
        # Rango invalido -> default del slot por posicion.
        if not is_valid_range(range_key):
            range_key = default["range"]
        # Intervalo no disponible PARA ESE RANGO -> intervalo por defecto del
        # rango (repara combos invalidos guardados por versiones previas).
        if not is_supported_combo(range_key, interval):
            interval = default_interval_for_range(range_key)
        out: dict[str, str] = {
            "slotId": str(slot.get("slotId") or default["slotId"]),
            "range": range_key,
            "interval": interval,
        }
        label = slot.get("label")
        if isinstance(label, str) and label:
            out["label"] = label
        result.append(out)
    return result


def merge_chart_slots(
    existing: list[dict] | None, updates: list[dict] | None
) -> list[dict[str, str]]:
    """Aplica `updates` (parciales, por slotId) sobre los slots existentes.

    Slots no mencionados se conservan intactos. Devuelve siempre seis slots.
    Asi un PATCH de un solo slot no pisa la configuracion de los otros cinco.
    """
    base = normalize_chart_slots(existing)
    by_id = {s["slotId"]: s for s in base}
    for upd in updates or []:
        if not isinstance(upd, dict):
            continue
        sid = str(upd.get("slotId") or "")
        target = by_id.get(sid)
        if target is None:
            continue
        range_key = str(upd.get("range") or target["range"])
        interval = str(upd.get("interval") or target["interval"])
        if is_valid_range(range_key):
            target["range"] = range_key
        # Repara el intervalo al default del rango si la combinacion no aplica.
        if is_supported_combo(target["range"], interval):
            target["interval"] = interval
        elif not is_supported_combo(target["range"], target["interval"]):
            target["interval"] = default_interval_for_range(target["range"])
        label = upd.get("label")
        if isinstance(label, str) and label:
            target["label"] = label
    return base


def default_workspace_configuration(
    symbol: str, c010_id: int, name: str
) -> dict:
    """Estructura JSON por defecto para un workspace nuevo (seis slots default)."""
    return {
        "version": WORKSPACE_CONFIG_VERSION,
        "workspaceType": WORKSPACE_TYPE,
        "workspaceName": name,
        "symbol": symbol,
        "c010Id": c010_id,
        "chartSlots": [dict(s) for s in DEFAULT_CHART_SLOTS],
        "panelSettings": {"showVolume": True, "showIndicators": True},
        "lastOpenedAt": datetime.now(timezone.utc).isoformat(),
    }


# --- Resolucion a argumentos de yfinance -------------------------------------
@dataclass(frozen=True)
class CandleQuery:
    interval: str
    period: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None


# yfinance acepta estos `period` directamente. "1W"/"1D" se resuelven con
# start/end porque yfinance no admite "7d" como period.
_RANGE_PERIOD: dict[str, Optional[str]] = {
    "5Y": "5y",
    "1Y": "1y",
    "6M": "6mo",
    "3M": "3mo",
    "1M": "1mo",
    "1W": None,  # start/end (7 dias)
    "1D": None,  # start/end (1 dia)
}


def resolve_candle_query(
    range_key: str, interval: str, now: Optional[datetime] = None
) -> CandleQuery:
    """Traduce (range, interval) a los argumentos exactos de yfinance."""
    validate_range_interval(range_key, interval)
    now = now or datetime.now(timezone.utc)
    period = _RANGE_PERIOD.get(range_key)
    if period is not None:
        return CandleQuery(interval=interval, period=period)
    start = now - timedelta(days=RANGE_DAYS[range_key])
    return CandleQuery(interval=interval, start=start, end=now)


def range_visible_span_days(range_key: str) -> int:
    return RANGE_DAYS.get(range_key, 365)
