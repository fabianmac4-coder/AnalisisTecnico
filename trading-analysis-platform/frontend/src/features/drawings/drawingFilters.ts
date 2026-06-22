// Visibilidad de dibujos: a NIVEL de WORKSPACE de análisis. Un dibujo manual
// pertenece al análisis (usuario + acción + workspace) y se REPLICA en las seis
// gráficas; cada panel lo proyecta a su propia escala.
//
// PERO se pueden ocultar/borrar por GRÁFICA DE ORIGEN (donde se creó): toggle
// "Dibujos de Gráfica N" actúa global (en las seis), usando `chartSlotId` como
// metadata de origen. El aislamiento por usuario/acción/workspace lo garantizan
// el backend (GET /api/drawings?symbol&c030Id) y el drawingStore.

import type { Drawing } from "./drawingTypes";
import { normalizeTimeframeKey } from "./drawingMigration";

export type DrawingVisibilityFilters = Record<string, boolean>;

// Mapeo histórico: los seis presets fijos antiguos → su gráfica de origen por
// posición (para dibujos creados antes de guardar chartSlotId).
export const HISTORICAL_TIMEFRAME_TO_SLOT: Record<string, string> = {
  "4Y_1W": "chart_1",
  "1Y_1D": "chart_2",
  "6M_1D": "chart_3",
  "3M_1D": "chart_4",
  "1M_1H": "chart_5",
  "1W_30M": "chart_6",
};

/**
 * Gráfica de ORIGEN de un dibujo (donde se creó), SOLO para los controles de
 * gestión (ocultar/borrar por Gráfica). NO se usa para decidir en qué paneles se
 * ve (eso es workspace-wide).
 *  1. `style.chartSlotId` (dibujos nuevos = createdFrom),
 *  2. mapeo histórico de la temporalidad de origen (dibujos viejos),
 *  3. null.
 */
export function getDrawingOriginChartSlotId(drawing: Drawing): string | null {
  const explicit = drawing.style?.chartSlotId ?? drawing.style?.position?.chartSlotId;
  if (explicit) return explicit;
  const mapped = HISTORICAL_TIMEFRAME_TO_SLOT[normalizeTimeframeKey(drawing.sourceTimeframe)];
  return mapped ?? null;
}

/**
 * Dibujos visibles de un panel = TODOS los del análisis activo (workspace),
 * salvo los cuya GRÁFICA DE ORIGEN esté oculta por el usuario (`hiddenOrigins`).
 * El render decide si son dibujables en el rango visible de cada panel.
 */
export function getVisibleDrawingsForPanel(params: {
  drawings: Drawing[];
  activeSymbol: string;
  /** Gráficas de origen ocultadas por el usuario (chart_1…chart_6). */
  hiddenOrigins?: ReadonlySet<string>;
}): Drawing[] {
  const { drawings, activeSymbol, hiddenOrigins } = params;
  return drawings.filter((d) => {
    if (d.symbol !== activeSymbol || !d.visible) return false;
    if (hiddenOrigins && hiddenOrigins.size > 0) {
      const origin = getDrawingOriginChartSlotId(d);
      if (origin != null && hiddenOrigins.has(origin)) return false;
    }
    return true;
  });
}
