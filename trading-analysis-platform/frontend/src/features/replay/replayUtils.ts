// Utilidades PURAS del Modo Replay (práctica histórica). Sin estado ni red.
// El replay OCULTA las velas posteriores a un "cursor" temporal (ms UTC) para
// practicar proyecciones sin ver el futuro; luego se avanza vela a vela.

import type { Candle } from "@/features/charting/chartEngine/ChartEngineAdapter";

/** Velocidades de reproducción (multiplicador). */
export const REPLAY_SPEED_OPTIONS = [1, 2, 5, 10] as const;

/** Intervalo base (ms) entre velas al reproducir a 1x. */
export const REPLAY_BASE_STEP_MS = 1500;

/** Intervalo real entre pasos según el multiplicador de velocidad. */
export function replayStepMs(multiplier: number): number {
  const m = multiplier > 0 ? multiplier : 1;
  return Math.max(200, Math.round(REPLAY_BASE_STEP_MS / m));
}

/** Minutos aproximados de un intervalo (para elegir la temporalidad más fina). */
export function intervalToMinutes(interval: string): number {
  switch (interval) {
    case "1m":
      return 1;
    case "5m":
      return 5;
    case "15m":
      return 15;
    case "30m":
      return 30;
    case "1h":
      return 60;
    case "1d":
      return 1440;
    case "1wk":
      return 10080;
    case "1mo":
      return 43200;
    default:
      return 1440;
  }
}

/**
 * Filtra barras dejando solo las de tiempo <= cursorTime (ms). Si cursorTime es
 * null devuelve TODAS (sin recorte). No muta el arreglo de entrada.
 */
export function filterBarsToCursor<T extends { time: number }>(
  bars: T[],
  cursorTime: number | null
): T[] {
  if (cursorTime == null) return bars;
  return bars.filter((b) => b.time <= cursorTime);
}

/**
 * Siguiente tiempo de vela estrictamente mayor que el cursor (los tiempos deben
 * venir ascendentes). Si el cursor es null, devuelve el último. null si no hay.
 */
export function nextReplayTime(times: number[], cursor: number | null): number | null {
  if (cursor == null) return times.length ? times[times.length - 1] : null;
  for (const t of times) if (t > cursor) return t;
  return null;
}

/** Tiempo de vela anterior (estrictamente menor) al cursor. null si no hay. */
export function prevReplayTime(times: number[], cursor: number | null): number | null {
  if (cursor == null) return null;
  let prev: number | null = null;
  for (const t of times) {
    if (t < cursor) prev = t;
    else break;
  }
  return prev;
}

/**
 * Cursor por defecto al activar replay: deja `revealCount` velas ocultas al
 * final (para tener "futuro" que revelar). Usa la temporalidad de referencia.
 */
export function defaultReplayCursor(times: number[], revealCount = 20): number | null {
  if (!times.length) return null;
  const idx = Math.max(0, times.length - 1 - revealCount);
  return times[idx];
}

/** Última vela con tiempo <= cursor (para mostrar el "precio actual" del replay). */
export function lastBarAtOrBefore(bars: Candle[], cursor: number | null): Candle | null {
  if (cursor == null) return bars.length ? bars[bars.length - 1] : null;
  let last: Candle | null = null;
  for (const b of bars) {
    if (b.time <= cursor) last = b;
    else break;
  }
  return last;
}
