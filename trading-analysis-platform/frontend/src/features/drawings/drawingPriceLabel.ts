// Helpers PUROS para las etiquetas de precio en los extremos de las líneas.
// El precio sale SIEMPRE de los puntos guardados (PuntosJSON), nunca del cierre
// de la vela actual. Sin estado ni DOM.

import type { Drawing } from "./drawingTypes";
import type { LocalPoint } from "./chartCoordinateUtils";

/** Tipos de línea que muestran etiquetas de precio en sus extremos. */
export const PRICE_LABEL_LINE_TYPES = new Set<Drawing["type"]>([
  "free_line",
  "dotted_line",
  "extended_trendline",
]);

/**
 * Formato compacto de precio para etiquetas: decimales según la magnitud
 * (acciones 2; <1 forex/cripto 4; <0.01 activos muy baratos 6). No abusa de
 * decimales en precios normales.
 */
export function formatDrawingPrice(price: number): string {
  if (!Number.isFinite(price)) return "";
  const abs = Math.abs(price);
  let decimals = 2;
  if (abs !== 0 && abs < 0.01) decimals = 6;
  else if (abs < 1) decimals = 4;
  return price.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * ¿Mostrar etiquetas de precio para este dibujo? Solo tipos de línea, si la
 * preferencia global está activa y el dibujo no las desactivó explícitamente.
 */
export function shouldShowPriceLabels(d: Drawing, globalEnabled: boolean): boolean {
  if (!PRICE_LABEL_LINE_TYPES.has(d.type)) return false;
  // Línea horizontal: la etiqueta de precio es OBLIGATORIA (ignora la
  // preferencia global y no se puede ocultar por defecto).
  if (d.style.horizontalLock) return true;
  if (!globalEnabled) return false;
  if (d.style.showEndpointPriceLabels === false) return false;
  return true;
}

/**
 * ¿El extremo (en píxeles) está dentro del área visible del panel? Si el panel
 * aún no se ha medido (size 0) no se filtra. Evita colocar etiquetas en los
 * bordes cuando el extremo quedó fuera de la vista.
 */
export function isEndpointVisible(
  lp: LocalPoint,
  size: { w: number; h: number }
): boolean {
  if (size.w <= 0 || size.h <= 0) return true; // aún sin medir: no filtrar
  const m = 2;
  return lp.x >= -m && lp.x <= size.w + m && lp.y >= -m && lp.y <= size.h + m;
}
