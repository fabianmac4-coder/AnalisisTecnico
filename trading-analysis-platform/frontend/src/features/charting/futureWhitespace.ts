// Espacio en blanco "futuro" para poder dibujar mas alla del ultimo candle.
//
// Lightweight Charts solo permite convertir coordenadas <-> tiempo dentro del
// dominio de la serie. Para habilitar clicks en el area futura, se anexan
// puntos de WHITESPACE (solo { time }, SIN open/high/low/close/volume) despues
// del ultimo bar real. No son velas falsas: la libreria los trata como huecos.
//
// Los datos OHLCV reales no se mutan: los indicadores siguen calculandose solo
// con los bars reales.

import type { PresetKey } from "@/utils/timeframes";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Paso de tiempo entre velas para cada preset historico (ms). */
export const PRESET_STEP_MS: Record<PresetKey, number> = {
  "4Y_1W": 7 * DAY_MS,
  "1Y_1D": DAY_MS,
  "6M_1D": DAY_MS,
  "3M_1D": DAY_MS,
  "1M_1H": HOUR_MS,
  "1W_30M": 30 * MINUTE_MS,
};

/** Cuantos huecos futuros agregar por preset historico. */
export const FUTURE_WHITESPACE_COUNT: Record<PresetKey, number> = {
  "4Y_1W": 52, // ~1 anio de semanas
  "1Y_1D": 90,
  "6M_1D": 60,
  "3M_1D": 45,
  "1M_1H": 80,
  "1W_30M": 80,
};

// Fallback por token de intervalo (sufijo tras "_"), para contextKeys dinamicos
// (ej. "1Y_1h", "6M_30m"). Cubre tanto el formato historico (1D/1W/1H/30M) como
// el de yfinance (1d/1wk/1mo/1h/30m/15m/5m/1m).
const STEP_BY_TOKEN: Record<string, number> = {
  "1mo": 30 * DAY_MS,
  "1wk": 7 * DAY_MS,
  "1w": 7 * DAY_MS,
  "1d": DAY_MS,
  "1h": HOUR_MS,
  "30m": 30 * MINUTE_MS,
  "15m": 15 * MINUTE_MS,
  "5m": 5 * MINUTE_MS,
  "1m": MINUTE_MS,
};

const COUNT_BY_TOKEN: Record<string, number> = {
  "1mo": 18,
  "1wk": 52,
  "1w": 52,
  "1d": 90,
  "1h": 80,
  "30m": 80,
  "15m": 80,
  "5m": 80,
  "1m": 80,
};

function tokenOf(key: string): string {
  return (key.split("_").pop() ?? "1d").toLowerCase();
}

export function stepMsForTimeframe(key: string): number {
  if (key in PRESET_STEP_MS) return PRESET_STEP_MS[key as PresetKey];
  return STEP_BY_TOKEN[tokenOf(key)] ?? DAY_MS;
}

export function getFutureWhitespaceCount(key: string): number {
  if (key in FUTURE_WHITESPACE_COUNT) return FUTURE_WHITESPACE_COUNT[key as PresetKey];
  return COUNT_BY_TOKEN[tokenOf(key)] ?? 60;
}

/**
 * Genera los tiempos futuros (Unix ms) posteriores al ultimo bar real.
 * El adaptador los convierte a segundos y los anexa como WhitespaceData.
 */
export function createFutureWhitespace(params: {
  lastTimeMs: number;
  preset: string;
  count?: number;
}): number[] {
  const { lastTimeMs, preset } = params;
  if (!Number.isFinite(lastTimeMs)) return [];
  const count = params.count ?? getFutureWhitespaceCount(preset);
  const step = stepMsForTimeframe(preset);
  const out: number[] = [];
  for (let i = 1; i <= count; i++) {
    out.push(lastTimeMs + i * step);
  }
  return out;
}
