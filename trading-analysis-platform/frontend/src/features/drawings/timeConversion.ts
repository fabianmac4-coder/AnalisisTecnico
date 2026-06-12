// Conversion de unidades de tiempo entre el almacenamiento (Unix ms) y
// Lightweight Charts (UTCTimestamp en SEGUNDOS). Fuente unica de verdad: si
// mezclas ms y segundos, los dibujos quedan en el lugar equivocado.

import type { Time, UTCTimestamp } from "lightweight-charts";

/** Unix milliseconds (almacenamiento) -> UTCTimestamp en segundos (LWC). */
export function msToChartTime(timeMs: number): UTCTimestamp {
  return Math.floor(timeMs / 1000) as UTCTimestamp;
}

/** Time de LWC (segundos | "yyyy-mm-dd" | BusinessDay) -> Unix milliseconds. */
export function chartTimeToMs(time: Time): number {
  if (typeof time === "number") return time * 1000;
  if (typeof time === "string") return new Date(`${time}T00:00:00Z`).getTime();
  // BusinessDay { year, month, day }
  return Date.UTC(time.year, time.month - 1, time.day);
}

/**
 * Normaliza un tiempo numerico AMBIGUO a Unix milliseconds: si parece estar en
 * segundos (umbral 1e11, el mismo de la migracion de dibujos) lo multiplica
 * por 1000; si ya esta en ms lo deja igual. Usar al tomar el tiempo de la
 * ultima vela como referencia (las velas del store ya estan en ms, pero esta
 * funcion evita una doble conversion accidental).
 */
export function normalizeChartTimeToMs(time: number): number {
  if (!Number.isFinite(time)) return time;
  return Math.abs(time) < 1e11 ? time * 1000 : time;
}
