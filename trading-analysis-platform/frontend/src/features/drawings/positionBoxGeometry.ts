// Geometría de las cajas de PLAN de posición (Long/Short). Los TRES puntos
// (entry/target/stop) son UN objeto coherente, no puntos independientes:
//   points[0] = entry  (entryTime, entryPrice)   -> línea de entrada
//   points[1] = target (endTime,  targetPrice)   -> objetivo (recompensa)
//   points[2] = stop   (endTime,  stopPrice)     -> stop (riesgo)
// Funciones PURAS, fáciles de testear; nunca lanzan.

import type { DrawingPoint, PositionBoxType } from "./drawingTypes";

/** Rol de cada manija según el índice de su punto. */
export type PositionBoxHandleRole = "ENTRY" | "TARGET" | "STOP";
export const POSITION_HANDLE_ROLES: readonly PositionBoxHandleRole[] = [
  "ENTRY",
  "TARGET",
  "STOP",
];

/** Gap mínimo para que target/stop no crucen ni toquen la entrada. */
function minGap(entryPrice: number): number {
  return Math.max(Math.abs(entryPrice) * 1e-4, 1e-6);
}

/**
 * Construye los 3 puntos canónicos a partir de la geometría. Se usa al crear,
 * al editar en el modal y tras arrastrar, para que `points[]` NUNCA diverja de
 * la geometría (entry/target/stop + tiempos).
 */
export function buildPositionBoxPoints(geom: {
  entryTime: number;
  endTime: number;
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
}): DrawingPoint[] {
  return [
    { time: geom.entryTime, price: geom.entryPrice },
    { time: geom.endTime, price: geom.targetPrice },
    { time: geom.endTime, price: geom.stopPrice },
  ];
}

/**
 * Redimensiona la caja horizontalmente: mueve el borde DERECHO (endTime) sin
 * tocar precios ni la entrada. `newEndTime` se clampa para que la caja conserve
 * un ancho mínimo positivo (no se invierte ni colapsa). target y stop comparten
 * el endTime, así que ambos se actualizan a la vez.
 */
export function resizePositionBoxRightEdge(params: {
  original: DrawingPoint[];
  newEndTime: number;
  minStepMs?: number;
}): DrawingPoint[] {
  const { original, newEndTime } = params;
  const minStepMs = Math.max(params.minStepMs ?? 1, 1);
  if (original.length < 3 || !Number.isFinite(newEndTime)) return original;
  const [entry, target, stop] = original;
  const end = Math.max(newEndTime, entry.time + minStepMs);
  return [
    entry,
    { time: end, price: target.price },
    { time: end, price: stop.price },
  ];
}

/**
 * Recalcula los TRES puntos tras arrastrar UNA manija, manteniendo la caja
 * coherente:
 * - ENTRY (índice 0): desplaza las tres líneas de precio por el mismo delta
 *   (preserva las distancias riesgo/recompensa). Los tiempos no cambian.
 * - TARGET (índice 1): cambia SOLO el precio objetivo; clamp al lado válido de
 *   la entrada (LONG: por encima; SHORT: por debajo). Conserva su tiempo.
 * - STOP (índice 2): cambia SOLO el precio de stop; clamp al lado válido
 *   (LONG: por debajo; SHORT: por encima). Conserva su tiempo.
 *
 * `original` es el snapshot del pointer-down (no se compone sobre valores ya
 * mutados → sin drift ni manijas que se desconectan).
 */
export function dragPositionBoxPoints(params: {
  type: PositionBoxType;
  original: DrawingPoint[];
  handleIndex: number; // 0=entry, 1=target, 2=stop
  pointerPrice: number;
}): DrawingPoint[] {
  const { type, original, handleIndex, pointerPrice } = params;
  if (original.length < 3 || !Number.isFinite(pointerPrice)) return original;
  const [entry, target, stop] = original;
  const isLong = type === "LONG_POSITION";

  // ENTRY: mueve toda la estructura de precios manteniendo distancias.
  if (handleIndex === 0) {
    const delta = pointerPrice - entry.price;
    return [
      { time: entry.time, price: entry.price + delta },
      { time: target.time, price: target.price + delta },
      { time: stop.time, price: stop.price + delta },
    ];
  }

  const gap = minGap(entry.price);
  if (handleIndex === 1) {
    // TARGET
    const price = isLong
      ? Math.max(pointerPrice, entry.price + gap)
      : Math.min(pointerPrice, entry.price - gap);
    return [entry, { time: target.time, price }, stop];
  }

  // STOP (handleIndex === 2)
  const price = isLong
    ? Math.min(pointerPrice, entry.price - gap)
    : Math.max(pointerPrice, entry.price + gap);
  return [entry, target, { time: stop.time, price }];
}
