// Colores de dibujo por temporalidad de origen. Cada temporalidad tiene un
// color por defecto; el usuario puede cambiarlo (persistido en layoutStore).

import type { PresetKey } from "@/utils/timeframes";
import type { Drawing } from "./drawingTypes";

export const DEFAULT_TIMEFRAME_DRAWING_COLORS: Record<PresetKey, string> = {
  "4Y_1W": "#f97316", // naranja
  "1Y_1D": "#3b82f6", // azul
  "6M_1D": "#ef4444", // rojo
  "3M_1D": "#a855f7", // morado
  "1M_1H": "#22c55e", // verde
  "1W_30M": "#eab308", // amarillo
};

/**
 * Color efectivo de un dibujo: si usa el color por temporalidad, toma el del
 * mapa actual; si tiene color propio (override), respeta su color guardado.
 */
export function resolveDrawingColor(
  drawing: Drawing,
  timeframeColors: Record<PresetKey, string>
): string {
  if (drawing.style.usesTimeframeDefaultColor) {
    return timeframeColors[drawing.sourceTimeframe] ?? drawing.style.color;
  }
  return drawing.style.color;
}
