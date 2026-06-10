import { useState } from "react";
import { useChartStore } from "@/stores/chartStore";
import { PRESET_KEYS, type PresetKey } from "@/utils/timeframes";
import { ChartPanel } from "./ChartPanel";
import { ChartToolbar } from "./ChartToolbar";
import { ExpandedChartModal } from "./ExpandedChartModal";
import { DrawingFilterToolbar } from "@/features/drawings/DrawingFilterToolbar";
import { IndicatorToolbar } from "@/features/indicators/IndicatorToolbar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/** Dashboard 3x2 con las seis temporalidades del simbolo activo. */
export function ChartGrid() {
  const activeSymbol = useChartStore((s) => s.activeSymbol);
  const [expanded, setExpanded] = useState<PresetKey | null>(null);

  if (!activeSymbol) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted">
        <span className="text-4xl">📈</span>
        <p className="text-sm">Busca un ticker (ej. AAPL) para cargar sus seis gráficas.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChartToolbar symbol={activeSymbol} />
      <DrawingFilterToolbar />
      <IndicatorToolbar />
      <div className="grid flex-1 grid-cols-1 gap-2 overflow-auto p-2 md:grid-cols-2 xl:grid-cols-3">
        {PRESET_KEYS.map((preset) => (
          <div key={preset} className="min-h-[280px]">
            {/* Si un panel crashea, los otros cinco siguen funcionando. */}
            <ErrorBoundary variant="panel" label={preset}>
              <ChartPanel preset={preset} symbol={activeSymbol} onExpand={setExpanded} />
            </ErrorBoundary>
          </div>
        ))}
      </div>

      {expanded && (
        <ExpandedChartModal
          preset={expanded}
          symbol={activeSymbol}
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  );
}
