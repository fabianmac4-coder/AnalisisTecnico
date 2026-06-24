import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { useSymbolStore } from "@/stores/symbolStore";
import { useStockScorecardStore, selectScorecard } from "@/features/stockScorecard/stockScorecardStore";
import { formatInstrumentDisplayName } from "@/features/symbols/instrumentName";
import type { ChartType } from "./chartEngine/ChartEngineAdapter";
import { ChartTimezoneSelector } from "@/features/charts/timezone/ChartTimezoneSelector";
import { ChartTemplateMenu } from "@/features/charts/ChartTemplateMenu";

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
  // Nombre del instrumento: catálogo o scorecard. Muestra "TICKER · Nombre".
  const catalogName = useSymbolStore((s) => s.catalog.find((c) => c.symbol === symbol)?.name);
  const scorecardName = useStockScorecardStore((s) => selectScorecard(s, symbol)?.companyName);
  const instrumentDisplay = formatInstrumentDisplayName(symbol, catalogName, scorecardName);
  // Zona horaria del exchange del símbolo activo (de cualquier slot cargado).
  const exchangeTimezone = useChartStore((s) => {
    for (const d of Object.values(s.chartDataBySlot)) {
      if (d?.symbol === symbol && (d.exchangeTimezone || d.timezone)) {
        return d.exchangeTimezone ?? d.timezone ?? null;
      }
    }
    return null;
  });

  return (
    <div className="flex items-center justify-between gap-3 border-b border-edge bg-panel px-3 py-1.5">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="max-w-[20rem] truncate font-semibold text-gray-100" title={instrumentDisplay}>
          {instrumentDisplay}
        </span>
        <span>·</span>
        <span>
          Herramienta: <span className="text-accent">{activeTool}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ChartTemplateMenu symbol={symbol} />
        <ChartTimezoneSelector exchangeTimezone={exchangeTimezone} />
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
