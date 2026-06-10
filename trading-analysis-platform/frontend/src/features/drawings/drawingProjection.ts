// Proyeccion de lineas a tiempo/precio. Permite ver una recta dibujada en 4Y
// sobre el chart de 1 semana: se extiende la recta (definida por dos puntos
// time/price) y se evalua su precio en el rango de tiempo visible.

import type { DrawingPoint } from "./drawingTypes";

/**
 * Proyecta la recta definida por los dos puntos del dibujo sobre [start, end].
 * Devuelve los dos extremos (precio evaluado en start y en end), o null si la
 * recta es vertical (mismo time) o produce valores invalidos.
 */
export function projectLineToVisibleRange(
  points: DrawingPoint[],
  visibleStartMs: number,
  visibleEndMs: number
): [DrawingPoint, DrawingPoint] | null {
  const p1 = points[0];
  const p2 = points[1];
  if (!p1 || !p2) return null;
  if (p1.time === p2.time) return null; // vertical: no proyectable como recta

  const slope = (p2.price - p1.price) / (p2.time - p1.time);
  const priceAtStart = p1.price + slope * (visibleStartMs - p1.time);
  const priceAtEnd = p1.price + slope * (visibleEndMs - p1.time);

  if (!Number.isFinite(priceAtStart) || !Number.isFinite(priceAtEnd)) return null;

  return [
    { time: visibleStartMs, price: priceAtStart },
    { time: visibleEndMs, price: priceAtEnd },
  ];
}

/**
 * RECORTA (clip) un segmento FINITO al rango de tiempo visible. A diferencia de
 * `projectLineToVisibleRange`, NUNCA extiende mas alla de los puntos originales:
 * solo devuelve la porcion del segmento A-B que cae dentro de [start, end].
 *
 * - Ambos extremos visibles -> devuelve exactamente A y B (su sub-rango).
 * - Parcialmente visible -> devuelve solo la parte visible.
 * - Fuera del rango visible -> null (no se dibuja en ese chart).
 * - Vertical (mismo time) o valores invalidos -> null.
 */
export function clipFreeLineSegmentToVisibleRange(params: {
  p1: DrawingPoint;
  p2: DrawingPoint;
  visibleStartMs: number;
  visibleEndMs: number;
}): [DrawingPoint, DrawingPoint] | null {
  const { p1, p2, visibleStartMs, visibleEndMs } = params;
  if (!p1 || !p2) return null;
  if (!Number.isFinite(p1.time) || !Number.isFinite(p2.time)) return null;
  if (!Number.isFinite(p1.price) || !Number.isFinite(p2.price)) return null;
  if (p1.time === p2.time) return null;

  const segmentStartMs = Math.min(p1.time, p2.time);
  const segmentEndMs = Math.max(p1.time, p2.time);

  const clippedStartMs = Math.max(segmentStartMs, visibleStartMs);
  const clippedEndMs = Math.min(segmentEndMs, visibleEndMs);
  if (clippedStartMs > clippedEndMs) return null;

  const slope = (p2.price - p1.price) / (p2.time - p1.time);
  const priceAt = (timeMs: number) => p1.price + slope * (timeMs - p1.time);

  return [
    { time: clippedStartMs, price: priceAt(clippedStartMs) },
    { time: clippedEndMs, price: priceAt(clippedEndMs) },
  ];
}

/** True si el rango de tiempo del dibujo solapa con la ventana visible. */
export function overlapsVisibleRange(
  points: DrawingPoint[],
  visibleStartMs: number,
  visibleEndMs: number
): boolean {
  if (points.length === 0) return false;
  const times = points.map((p) => p.time);
  const min = Math.min(...times);
  const max = Math.max(...times);
  return max >= visibleStartMs && min <= visibleEndMs;
}
