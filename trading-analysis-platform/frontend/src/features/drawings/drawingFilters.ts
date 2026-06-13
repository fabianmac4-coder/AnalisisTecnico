// Filtro puro de dibujos por panel. Los dibujos son GLOBALES a las seis
// temporalidades; los filtros de visibilidad por temporalidad de origen
// (en el toolbar del dashboard) deciden cuales se muestran.

import type { Drawing } from "./drawingTypes";
import { normalizeTimeframeKey } from "./drawingMigration";

export type DrawingVisibilityFilters = Record<string, boolean>;

export function getVisibleDrawingsForPanel(params: {
  drawings: Drawing[];
  activeSymbol: string;
  panelTimeframe: string;
  visibilityFilters: DrawingVisibilityFilters;
}): Drawing[] {
  const { drawings, activeSymbol, panelTimeframe, visibilityFilters } = params;
  return drawings.filter((d) => {
    if (d.symbol !== activeSymbol) return false;
    if (!d.visible) return false;

    const source = normalizeTimeframeKey(d.sourceTimeframe);
    // Solo un `false` EXPLICITO oculta; una temporalidad desconocida (combo
    // personalizado sin chip) se considera visible por defecto.
    if (visibilityFilters[source] === false) return false;

    // Visible en todas las temporalidades por defecto: solo un `false`
    // EXPLICITO restringe (un campo ausente en datos viejos cuenta como true).
    if (d.showOnAllTimeframes !== false) return true;
    if (d.showOnTimeframes?.includes(panelTimeframe)) return true;
    return source === panelTimeframe;
  });
}
