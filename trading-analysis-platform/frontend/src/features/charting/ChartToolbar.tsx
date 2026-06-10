import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import type { ChartType } from "./chartEngine/ChartEngineAdapter";

const QUICK_TYPES: { type: ChartType; label: string }[] = [
  { type: "candlestick", label: "Velas" },
  { type: "line", label: "Línea" },
  { type: "area", label: "Área" },
  { type: "bars", label: "Barras" },
];

/** Barra superior del dashboard: acciones globales sobre las seis graficas. */
export function ChartToolbar({ symbol }: { symbol: string }) {
  const setChartTypeAll = useChartStore((s) => s.setChartTypeAll);
  const activeTool = useDrawingStore((s) => s.activeTool);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-edge bg-panel px-3 py-1.5">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="font-semibold text-gray-100">{symbol}</span>
        <span>·</span>
        <span>
          Herramienta: <span className="text-accent">{activeTool}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted">Aplicar a todas:</span>
        {QUICK_TYPES.map((t) => (
          <button
            key={t.type}
            onClick={() => setChartTypeAll(t.type)}
            className="rounded bg-panel-3 px-2 py-0.5 text-[11px] text-gray-200 hover:bg-edge"
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
