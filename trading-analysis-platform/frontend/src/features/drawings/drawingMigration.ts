// Migracion segura de dibujos guardados con modelos anteriores.
//
// Cambios cubiertos:
// - sourceTimeframe "4Y_1D" -> "4Y_1W" (y dentro de showOnTimeframes).
// - showOnAllTimeframes ausente -> true (visibilidad global).
// - style.usesTimeframeDefaultColor ausente -> true.
// - tipo legado "trendline": si extendLeft/extendRight eran true se migra a
//   "extended_trendline" (recta proyectada); si no, a "free_line" (segmento).
// - free_line/dotted_line: fuerza extendLeft/extendRight = false (finitos).
// - rectangle/ellipse: fillOpacity por defecto si falta.
// - version -> 3.
// No se pierde ningun dibujo; los campos desconocidos se conservan.

import type { Drawing } from "./drawingTypes";

const OLD_4Y = "4Y_1D";
const NEW_4Y = "4Y_1W";

export function normalizeTimeframeKey(key: string): string {
  return key === OLD_4Y ? NEW_4Y : key;
}

/**
 * Normaliza un punto: time SIEMPRE en Unix milisegundos. Si un punto quedo
 * guardado en SEGUNDOS (bug historico posible en intradia), se convierte.
 * Heuristica: los segundos actuales rondan 1.7e9 y los ms 1.7e12; cualquier
 * valor positivo < 1e11 se interpreta como segundos.
 */
export function normalizeDrawingPoint(point: {
  time: unknown;
  price: unknown;
}): { time: number; price: number } {
  let time = Number(point.time);
  if (Number.isFinite(time) && time > 0 && time < 100_000_000_000) {
    time = time * 1000;
  }
  return { time, price: Number(point.price) };
}

export function migrateDrawing(raw: unknown): Drawing {
  const d = { ...(raw as Record<string, unknown>) } as Record<string, unknown> & Partial<Drawing>;

  // sourceTimeframe
  if (String(d.sourceTimeframe) === OLD_4Y) {
    d.sourceTimeframe = NEW_4Y as Drawing["sourceTimeframe"];
  }

  // showOnTimeframes (re-mapea 4Y_1D)
  if (Array.isArray(d.showOnTimeframes)) {
    d.showOnTimeframes = d.showOnTimeframes.map((tf) => normalizeTimeframeKey(String(tf)));
  }

  // Puntos: tiempo SIEMPRE en ms (corrige puntos guardados en segundos).
  if (Array.isArray(d.points)) {
    d.points = d.points.map((p) => normalizeDrawingPoint(p as { time: unknown; price: unknown }));
  }

  // Visibilidad global por defecto.
  if (typeof d.showOnAllTimeframes !== "boolean") {
    d.showOnAllTimeframes = true;
  }

  // Color por temporalidad por defecto.
  const style = (d.style ?? {}) as Drawing["style"];
  if (style.usesTimeframeDefaultColor === undefined) {
    style.usesTimeframeDefaultColor = true;
  }

  // Tipo legado "trendline": decide segun su intencion de extension.
  if (String(d.type) === "trendline") {
    d.type = style.extendLeft || style.extendRight ? "extended_trendline" : "free_line";
  }

  // Invariantes por tipo.
  if (d.type === "free_line" || d.type === "dotted_line") {
    // Segmentos FINITOS: nunca extendidos.
    style.extendLeft = false;
    style.extendRight = false;
  }
  if (d.type === "extended_trendline") {
    style.extendLeft = true;
    style.extendRight = true;
  }
  if ((d.type === "rectangle" || d.type === "ellipse") && style.fillOpacity === undefined) {
    style.fillOpacity = d.type === "rectangle" ? 0.12 : 0.1;
  }
  d.style = style;

  if (typeof d.version !== "number" || d.version < 3) {
    d.version = 3;
  }

  return d as Drawing;
}
