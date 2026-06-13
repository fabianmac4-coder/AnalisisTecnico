import { useMemo, useState } from "react";
import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { useLayoutStore } from "@/stores/layoutStore";
import {
  INTERVAL_LABEL,
  RANGE_LABEL,
  isIntradayInterval,
  slotSourceTimeframe,
  type ChartSlotConfig,
} from "@/features/charts/chartWorkspaceTypes";
import { ChartCanvas, type OverlayLine } from "./ChartCanvas";
import { ChartTypeSelector } from "./ChartTypeSelector";
import { DrawingToolbar } from "@/features/drawings/DrawingToolbar";
import { getVisibleDrawingsForPanel } from "@/features/drawings/drawingFilters";
import { resolveDisplayPriceFromSlots } from "./priceResolver";
import { MiniIndicatorChart, type IndicatorSeries } from "@/features/indicators/MiniIndicatorChart";
import {
  bollinger,
  closes,
  ema,
  macd,
  rsi,
  sma,
  toLinePoints,
} from "@/features/indicators/indicatorCalculations";

interface Props {
  slot: ChartSlotConfig;
  symbol: string;
  onClose: () => void;
}

type OverlayKey = "SMA20" | "SMA50" | "SMA200" | "EMA9" | "EMA21" | "BBANDS";

const OVERLAY_DEFS: { key: OverlayKey; label: string; color: string }[] = [
  { key: "SMA20", label: "SMA 20", color: "#f59e0b" },
  { key: "SMA50", label: "SMA 50", color: "#a855f7" },
  { key: "SMA200", label: "SMA 200", color: "#ef4444" },
  { key: "EMA9", label: "EMA 9", color: "#22d3ee" },
  { key: "EMA21", label: "EMA 21", color: "#84cc16" },
  { key: "BBANDS", label: "Bollinger", color: "#64748b" },
];

/** Vista ampliada de una grafica con indicadores tecnicos. */
export function ExpandedChartModal({ slot, symbol, onClose }: Props) {
  const sourceTimeframe = slotSourceTimeframe(slot);
  const metaLabel = `${RANGE_LABEL[slot.range]} / ${INTERVAL_LABEL[slot.interval]}`;
  const intraday = isIntradayInterval(slot.interval);
  const data = useChartStore((s) => s.chartDataBySlot[slot.slotId]);
  const chartType = useChartStore((s) => s.chartTypeBySlot[slot.slotId]) ?? "candlestick";
  const setSlotChartType = useChartStore((s) => s.setSlotChartType);
  const quote = useChartStore((s) => s.quoteBySymbol[symbol]);
  const chartDataBySlot = useChartStore((s) => s.chartDataBySlot);
  const canonicalPrice = resolveDisplayPriceFromSlots(quote, Object.values(chartDataBySlot));
  const allDrawings = useDrawingStore((s) => s.drawingsBySymbol[symbol]) ?? [];
  const visibilityFilters = useLayoutStore((s) => s.drawingVisibilityFilters);
  const timeframeColors = useLayoutStore((s) => s.timeframeDrawingColors);

  const [enabled, setEnabled] = useState<Record<OverlayKey, boolean>>({
    SMA20: false,
    SMA50: false,
    SMA200: false,
    EMA9: false,
    EMA21: false,
    BBANDS: false,
  });
  const [showRsi, setShowRsi] = useState(true);
  const [showMacd, setShowMacd] = useState(true);

  const bars = data?.bars ?? [];
  const drawings = getVisibleDrawingsForPanel({
    drawings: allDrawings,
    activeSymbol: symbol,
    panelTimeframe: sourceTimeframe,
    visibilityFilters,
  });

  const overlays = useMemo<OverlayLine[]>(() => {
    if (bars.length === 0) return [];
    const c = closes(bars);
    const out: OverlayLine[] = [];
    if (enabled.SMA20) out.push({ id: "SMA20", color: "#f59e0b", points: toLinePoints(bars, sma(c, 20)) });
    if (enabled.SMA50) out.push({ id: "SMA50", color: "#a855f7", points: toLinePoints(bars, sma(c, 50)) });
    if (enabled.SMA200) out.push({ id: "SMA200", color: "#ef4444", points: toLinePoints(bars, sma(c, 200)) });
    if (enabled.EMA9) out.push({ id: "EMA9", color: "#22d3ee", points: toLinePoints(bars, ema(c, 9)) });
    if (enabled.EMA21) out.push({ id: "EMA21", color: "#84cc16", points: toLinePoints(bars, ema(c, 21)) });
    if (enabled.BBANDS) {
      const bb = bollinger(c, 20, 2);
      out.push({ id: "BB_U", color: "#64748b", points: toLinePoints(bars, bb.upper) });
      out.push({ id: "BB_M", color: "#94a3b8", points: toLinePoints(bars, bb.mid) });
      out.push({ id: "BB_L", color: "#64748b", points: toLinePoints(bars, bb.lower) });
    }
    return out;
  }, [bars, enabled]);

  const rsiSeries = useMemo<IndicatorSeries[]>(() => {
    if (bars.length === 0) return [];
    return [{ id: "rsi", color: "#e879f9", points: toLinePoints(bars, rsi(closes(bars), 14)) }];
  }, [bars]);

  const macdSeries = useMemo<IndicatorSeries[]>(() => {
    if (bars.length === 0) return [];
    const m = macd(closes(bars));
    return [
      { id: "macd", color: "#3b82f6", points: toLinePoints(bars, m.macd) },
      { id: "signal", color: "#f59e0b", points: toLinePoints(bars, m.signal) },
      { id: "hist", color: "#26a69a", type: "histogram", points: toLinePoints(bars, m.histogram) },
    ];
  }, [bars]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-3">
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-edge bg-panel">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-edge px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-100">
              {symbol} · {metaLabel}
            </span>
            <ChartTypeSelector value={chartType} onChange={(t) => setSlotChartType(slot.slotId, t)} />
          </div>
          <button onClick={onClose} className="rounded bg-panel-3 px-3 py-1 text-xs hover:bg-edge">
            Cerrar ✕
          </button>
        </div>

        {/* Controles de indicadores */}
        <div className="flex flex-wrap items-center gap-1 border-b border-edge px-3 py-1.5 text-[11px]">
          {OVERLAY_DEFS.map((o) => (
            <button
              key={o.key}
              onClick={() => setEnabled((e) => ({ ...e, [o.key]: !e[o.key] }))}
              className={`rounded px-2 py-0.5 ${enabled[o.key] ? "text-white" : "bg-panel-3 text-muted"}`}
              style={enabled[o.key] ? { backgroundColor: o.color } : undefined}
            >
              {o.label}
            </button>
          ))}
          <span className="mx-1 text-edge">|</span>
          <button
            onClick={() => setShowRsi((v) => !v)}
            className={`rounded px-2 py-0.5 ${showRsi ? "bg-accent text-white" : "bg-panel-3 text-muted"}`}
          >
            RSI
          </button>
          <button
            onClick={() => setShowMacd((v) => !v)}
            className={`rounded px-2 py-0.5 ${showMacd ? "bg-accent text-white" : "bg-panel-3 text-muted"}`}
          >
            MACD
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex flex-1 overflow-hidden">
          <DrawingToolbar />
          <div className="flex flex-1 flex-col gap-2 overflow-auto p-2">
            <div className="min-h-[320px] flex-1">
              {bars.length > 0 ? (
                <ChartCanvas
                  candles={bars}
                  chartType={chartType}
                  intraday={intraday}
                  showVolume={chartType !== "volume"}
                  drawings={drawings}
                  symbol={symbol}
                  sourceTimeframe={sourceTimeframe}
                  editable
                  overlays={overlays}
                  timeframeColors={timeframeColors}
                  canonicalPrice={canonicalPrice}
                  canonicalChange={quote?.change ?? null}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted">Sin datos</div>
              )}
            </div>
            {showRsi && bars.length > 0 && <MiniIndicatorChart title="RSI (14)" series={rsiSeries} />}
            {showMacd && bars.length > 0 && (
              <MiniIndicatorChart title="MACD (12,26,9)" series={macdSeries} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
