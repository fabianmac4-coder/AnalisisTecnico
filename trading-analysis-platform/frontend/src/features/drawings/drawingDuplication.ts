// Duplicación PURA de un dibujo. Crea una copia con id local NUEVO (=> el
// repositorio la CREA en el backend) y un pequeño desplazamiento para que sea
// visible. Conserva tipo/estilo/temporalidad/workspace/visibilidad-global, así
// que la copia se REPLICA en las seis gráficas igual que el original (las cajas
// LONG/SHORT siguen acotadas a su temporalidad, como por diseño).

import type { Drawing } from "./drawingTypes";
import { newDrawingId } from "./createDrawing";

/** Desplazamiento del precio de la copia (fracción del precio medio). */
export const DUP_PRICE_OFFSET_PCT = 0.015;
/** Desplazamiento del tiempo de la copia (fracción del rango temporal). */
export const DUP_TIME_OFFSET_PCT = 0.05;

/**
 * Devuelve una COPIA del dibujo con id nuevo y un offset constante (traslación,
 * conserva la forma y, en cajas LONG/SHORT, la estructura riesgo/recompensa).
 */
export function duplicateDrawing(d: Drawing): Drawing {
  const now = new Date().toISOString();
  const prices = d.points.map((p) => p.price);
  const times = d.points.map((p) => p.time);
  const avgPrice = prices.length
    ? prices.reduce((a, b) => a + b, 0) / prices.length
    : 0;
  const span = times.length > 1 ? Math.max(...times) - Math.min(...times) : 0;
  // Delta CONSTANTE (no por punto) para no deformar el dibujo.
  const priceDelta = (Math.abs(avgPrice) || 1) * DUP_PRICE_OFFSET_PCT;
  const timeDelta = Math.round(span * DUP_TIME_OFFSET_PCT);
  const points = d.points.map((p) => ({
    time: p.time + timeDelta,
    price: p.price + priceDelta,
  }));
  const label = d.style.label ? `${d.style.label} copia` : undefined;
  return {
    ...d,
    id: newDrawingId(),
    points,
    style: { ...d.style, ...(label ? { label } : {}) },
    visible: true,
    locked: false,
    createdAt: now,
    updatedAt: now,
  };
}
