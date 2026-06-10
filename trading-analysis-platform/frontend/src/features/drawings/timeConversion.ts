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
