import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { useSymbolStore } from "@/stores/symbolStore";
import { useStockScorecardStore, selectScorecard } from "@/features/stockScorecard/stockScorecardStore";
import { formatInstrumentDisplayName } from "@/features/symbols/instrumentName";
import type { ChartType } from "./chartEngine/ChartEngineAdapter";
import { ChartTimezoneSelector } from "@/features/charts/timezone/ChartTimezoneSelector";
import { ChartTemplateMenu } from "@/features/charts/ChartTemplateMenu";
import { ReplayControls } from "@/features/replay/ReplayControls";
import { useReplayStore } from "@/features/replay/replayStore";
import { useRefreshStore } from "@/features/refresh/refreshStore";

const QUICK_TYPES: { type: ChartType; label: string }[] = [
  { type: "candlestick", label: "Velas" },
  { type: "line", label: "Línea" },
  { type: "area", label: "Área" },
  { type: "bars", label: "Barras" },
];

/** Barra superior del dashboard: acciones globales sobre las seis graficas. */
export function ChartToolbar({
  symbol,
  replayReferenceTimes = [],
}: {
  symbol: string;
  /** Tiempos de la temporalidad de referencia para los pasos del Replay. */
  replayReferenceTimes?: number[];
}) {
  const setChartTypeAll = useChartStore((s) => s.setChartTypeAll);
  const activeTool = useDrawingStore((s) => s.activeTool);
  const replayEnabled = useReplayStore((s) => s.enabled);
  const autoRefreshEnabled = useRefreshStore((s) => s.autoRefreshEnabled);
  const replayNote =
    replayEnabled && autoRefreshEnabled
      ? "Auto-recarga activa; los datos nuevos permanecerán ocultos mientras Replay esté activo."
      : null;
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
    <div className="border-b border-edge bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="max-w-[20rem] truncate font-semibold text-gray-100" title={instrumentDisplay}>
            {instrumentDisplay}
          </span>
          <span>·</span>
          <span>
            Herramienta: <span className="text-accent">{activeTool}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      {/* Fila de Modo Replay (práctica histórica). */}
      <div className="flex items-center gap-2 px-3 pb-1.5">
        <ReplayControls
          symbol={symbol}
          referenceTimes={replayReferenceTimes}
          note={replayNote}
        />
      </div>
    </div>
  );
}
