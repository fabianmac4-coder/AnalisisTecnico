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

/** Paso de tiempo entre velas para cada preset (ms). */
export const PRESET_STEP_MS: Record<PresetKey, number> = {
  "4Y_1W": 7 * DAY_MS,
  "1Y_1D": DAY_MS,
  "6M_1D": DAY_MS,
  "3M_1D": DAY_MS,
  "1M_1H": HOUR_MS,
  "1W_30M": 30 * MINUTE_MS,
};

/** Cuantos huecos futuros agregar por preset. */
export const FUTURE_WHITESPACE_COUNT: Record<PresetKey, number> = {
  "4Y_1W": 52, // ~1 anio de semanas
  "1Y_1D": 90,
  "6M_1D": 60,
  "3M_1D": 45,
  "1M_1H": 80,
  "1W_30M": 80,
};

export function getFutureWhitespaceCount(preset: PresetKey): number {
  return FUTURE_WHITESPACE_COUNT[preset];
}

/**
 * Genera los tiempos futuros (Unix ms) posteriores al ultimo bar real.
 * El adaptador los convierte a segundos y los anexa como WhitespaceData.
 */
export function createFutureWhitespace(params: {
  lastTimeMs: number;
  preset: PresetKey;
  count?: number;
}): number[] {
  const { lastTimeMs, preset } = params;
  if (!Number.isFinite(lastTimeMs)) return [];
  const count = params.count ?? FUTURE_WHITESPACE_COUNT[preset];
  const step = PRESET_STEP_MS[preset];
  const out: number[] = [];
  for (let i = 1; i <= count; i++) {
    out.push(lastTimeMs + i * step);
  }
  return out;
}
