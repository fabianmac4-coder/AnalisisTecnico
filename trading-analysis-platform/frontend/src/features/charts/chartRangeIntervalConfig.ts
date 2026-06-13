// Fuente UNICA de verdad de los intervalos disponibles por rango (UI). Debe
// coincidir con el backend (`app/chart_workspaces.py:AVAILABLE_INTERVALS_BY_RANGE`).
// El selector de intervalo solo muestra estos; combos fuera de la tabla no se
// ofrecen y el backend los rechaza (422) aunque llegue estado obsoleto.

import type { CandleInterval, ChartRange } from "./chartWorkspaceTypes";

export const AVAILABLE_INTERVALS_BY_RANGE: Record<ChartRange, CandleInterval[]> = {
  "5Y": ["1mo", "1wk", "1d"],
  "1Y": ["1mo", "1wk", "1d", "1h"],
  "6M": ["1wk", "1d", "1h", "30m", "15m"],
  "3M": ["1wk", "1d", "1h", "30m", "15m"],
  "1M": ["1d", "1h", "30m", "15m", "5m"],
  "1W": ["1h", "30m", "15m", "5m", "1m"],
  "1D": ["30m", "15m", "5m", "1m"],
};

// Intervalo por defecto al cambiar de rango (cuando el actual ya no es valido).
export const DEFAULT_INTERVAL_BY_RANGE: Record<ChartRange, CandleInterval> = {
  "5Y": "1wk",
  "1Y": "1d",
  "6M": "1d",
  "3M": "1d",
  "1M": "1h",
  "1W": "30m",
  "1D": "5m",
};

/** Intervalos disponibles para un rango (lo que el dropdown debe mostrar). */
export function availableIntervalsForRange(range: ChartRange): CandleInterval[] {
  return AVAILABLE_INTERVALS_BY_RANGE[range] ?? [];
}

/** True si la combinacion range/interval esta soportada por la UI. */
export function isSupportedRangeInterval(
  range: ChartRange,
  interval: CandleInterval
): boolean {
  return availableIntervalsForRange(range).includes(interval);
}

/** Intervalo por defecto valido para un rango. */
export function defaultIntervalForRange(range: ChartRange): CandleInterval {
  return DEFAULT_INTERVAL_BY_RANGE[range] ?? "1d";
}

/**
 * Devuelve un intervalo valido para el rango: conserva `interval` si aplica,
 * de lo contrario el default del rango. Se usa al cambiar de rango y al reparar
 * configuraciones guardadas con combinaciones invalidas.
 */
export function coerceIntervalForRange(
  range: ChartRange,
  interval: CandleInterval
): CandleInterval {
  return isSupportedRangeInterval(range, interval)
    ? interval
    : defaultIntervalForRange(range);
}
