// Colores de dibujo por temporalidad de origen. Cada temporalidad tiene un
// color por defecto; el usuario puede cambiarlo (persistido en layoutStore).

import type { Drawing } from "./drawingTypes";

// Color por defecto de las seis temporalidades historicas. Combos personalizados
// (contextKey dinamico) caen a DEFAULT_DRAWING_COLOR salvo override del usuario.
export const DEFAULT_TIMEFRAME_DRAWING_COLORS: Record<string, string> = {
  "4Y_1W": "#f97316", // naranja
  "1Y_1D": "#3b82f6", // azul
  "6M_1D": "#ef4444", // rojo
  "3M_1D": "#a855f7", // morado
  "1M_1H": "#22c55e", // verde
  "1W_30M": "#eab308", // amarillo
};

export const DEFAULT_DRAWING_COLOR = "#3b82f6";

/**
 * Color efectivo de un dibujo: si usa el color por temporalidad, toma el del
 * mapa actual; si tiene color propio (override), respeta su color guardado.
 */
export function resolveDrawingColor(
  drawing: Drawing,
  timeframeColors: Record<string, string>
): string {
  if (drawing.style.usesTimeframeDefaultColor) {
    return (
      timeframeColors[drawing.sourceTimeframe] ??
      DEFAULT_TIMEFRAME_DRAWING_COLORS[drawing.sourceTimeframe] ??
      drawing.style.color ??
      DEFAULT_DRAWING_COLOR
    );
  }
  return drawing.style.color;
}
