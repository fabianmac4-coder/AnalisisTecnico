import { useMemo, useState } from "react";
import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { useChartWorkspaceStore } from "@/features/charts/chartWorkspaceStore";
import {
  INTERVAL_LABEL,
  RANGE_LABEL,
  isIntradayInterval,
  slotSourceTimeframe,
  type ChartSlotConfig,
} from "@/features/charts/chartWorkspaceTypes";
import { SlotConfigSelector } from "@/features/charts/SlotConfigSelector";
import { formatPrice, formatPercent, formatVolume } from "@/utils/formatters";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { ChartCanvas } from "./ChartCanvas";
import { ChartTypeSelector } from "./ChartTypeSelector";
import { resolveDisplayPriceFromSlots } from "./priceResolver";
import { getVisibleDrawingsForPanel } from "@/features/drawings/drawingFilters";
import {
  buildPriceOverlays,
  buildRsiPane,
  buildMacdPane,
  findIndicator,
  isVolumeEnabled,
  getVolumeStyle,
} from "@/features/indicators/globalIndicators";
import { MiniIndicatorChart } from "@/features/indicators/MiniIndicatorChart";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

interface Props {
  slot: ChartSlotConfig;
  symbol: string;
  /** Workspace activo: cambiar el slot persiste en esta fila C030. */
  c030Id: number;
  workspaceName: string;
  index: number;
  onExpand: (slotId: string) => void;
}

/** Una de las seis graficas del workspace activo. Range/interval por slot. */
export function ChartPanel({ slot, symbol, c030Id, workspaceName, index, onExpand }: Props) {
  const sourceTimeframe = slotSourceTimeframe(slot);
  const intraday = isIntradayInterval(slot.interval);

  const data = useChartStore((s) => s.chartDataBySlot[slot.slotId]);
  const loading = useChartStore((s) => s.loadingBySlot[slot.slotId]);
  const error = useChartStore((s) => s.errorBySlot[slot.slotId]);
  const chartType = useChartStore((s) => s.chartTypeBySlot[slot.slotId]) ?? "candlestick";
  const setSlotChartType = useChartStore((s) => s.setSlotChartType);
  const reloadSlot = useChartStore((s) => s.reloadSlot);

  const updateChartSlot = useChartWorkspaceStore((s) => s.updateChartSlot);

  // Precio canonico: el MISMO en los seis paneles (cotizacion del simbolo).
  const quote = useChartStore((s) => s.quoteBySymbol[symbol]);
  const chartDataBySlot = useChartStore((s) => s.chartDataBySlot);

  const allDrawings = useDrawingStore((s) => s.drawingsBySymbol[symbol]) ?? [];
  const [drawingsVisible, setDrawingsVisible] = useState(true);

  const visibilityFilters = useLayoutStore((s) => s.drawingVisibilityFilters);
  const timeframeColors = useLayoutStore((s) => s.timeframeDrawingColors);
  const globalIndicators = useLayoutStore((s) => s.globalIndicators);

  const drawings = useMemo(
    () =>
      drawingsVisible
        ? getVisibleDrawingsForPanel({
            drawings: allDrawings,
            activeSymbol: symbol,
            panelTimeframe: sourceTimeframe,
            visibilityFilters,
          })
        : [],
    [allDrawings, drawingsVisible, sourceTimeframe, symbol, visibilityFilters]
  );

  const bars = data?.bars ?? [];
  const last = bars[bars.length - 1];

  const allBars = useMemo(
    () => [...(data?.warmupBars ?? []), ...bars],
    [data?.warmupBars, bars]
  );
  const visibleFromMs = data?.visibleFrom ?? bars[0]?.time ?? 0;

  const overlays = useMemo(
    () => buildPriceOverlays(allBars, visibleFromMs, globalIndicators),
    [allBars, visibleFromMs, globalIndicators]
  );
  const volumeOn = isVolumeEnabled(globalIndicators);
  const volumeStyle = useMemo(() => getVolumeStyle(globalIndicators), [globalIndicators]);

  const rsiCfg = findIndicator(globalIndicators, "RSI");
  const macdCfg = findIndicator(globalIndicators, "MACD");
  const rsiPane = useMemo(
    () => (rsiCfg?.visible && allBars.length > 0 ? buildRsiPane(allBars, visibleFromMs, rsiCfg) : null),
    [allBars, visibleFromMs, rsiCfg]
  );
  const macdPane = useMemo(
    () =>
      macdCfg?.visible && allBars.length > 0 ? buildMacdPane(allBars, visibleFromMs, macdCfg) : null,
    [allBars, visibleFromMs, macdCfg]
  );

  const displayPrice = useMemo(
    () => resolveDisplayPriceFromSlots(quote, Object.values(chartDataBySlot)),
    [quote, chartDataBySlot]
  );
  const change = quote?.change ?? null;
  const changePct = quote?.changePercent ?? null;
  const currency = quote?.currency ?? data?.currency;
  const changeClass =
    change == null || change === 0 ? "text-muted" : change > 0 ? "text-up" : "text-down";

  function handleSlotChange(range: ChartSlotConfig["range"], interval: ChartSlotConfig["interval"]) {
    void updateChartSlot(symbol, c030Id, slot.slotId, range, interval);
    void reloadSlot(symbol, { ...slot, range, interval });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-edge bg-panel">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 border-b border-edge px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="truncate text-xs font-semibold text-gray-200"
            title={`${workspaceName} · Chart ${index + 1} · ${RANGE_LABEL[slot.range]} / ${INTERVAL_LABEL[slot.interval]}`}
          >
            Chart {index + 1}
          </span>
          <SlotConfigSelector
            range={slot.range}
            interval={slot.interval}
            disabled={!!loading}
            onChange={handleSlotChange}
          />
        </div>
        <div className="flex items-center gap-2">
          <ChartTypeSelector value={chartType} onChange={(t) => setSlotChartType(slot.slotId, t)} compact />
          <IconButton
            title={drawingsVisible ? "Ocultar dibujos" : "Mostrar dibujos"}
            active={drawingsVisible}
            onClick={() => setDrawingsVisible((v) => !v)}
          >
            {drawingsVisible ? "👁" : "🚫"}
          </IconButton>
          <IconButton title="Expandir" onClick={() => onExpand(slot.slotId)}>
            ⤢
          </IconButton>
        </div>
      </div>

      {/* Linea de precio CANONICA (identica en los seis paneles) */}
      <div className="flex items-center gap-3 border-b border-edge px-2 py-1 text-[11px]">
        {displayPrice !== null ? (
          <>
            <span className="font-mono text-gray-100" title="Precio canónico del símbolo">
              {formatPrice(displayPrice, currency)}
            </span>
            {changePct !== null && (
              <span className={changeClass}>{formatPercent(changePct)}</span>
            )}
            {last?.volume != null && (
              <span className="text-muted">Vol {formatVolume(last.volume)}</span>
            )}
          </>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>

      {/* Cuerpo: grafica o estados */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel/60">
            <Spinner size={22} />
          </div>
        )}
        {error && !loading && bars.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 p-3 text-center">
            <span className="text-xs text-down">Error al cargar</span>
            <span className="text-[10px] text-muted">{error}</span>
          </div>
        )}
        {!loading && !error && bars.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
            Sin datos
          </div>
        )}
        {bars.length > 0 && (
          <ChartCanvas
            candles={bars}
            chartType={chartType}
            intraday={intraday}
            showVolume={volumeOn && chartType !== "volume"}
            drawings={drawings}
            symbol={symbol}
            sourceTimeframe={sourceTimeframe}
            editable
            overlays={overlays}
            timeframeColors={timeframeColors}
            canonicalPrice={displayPrice}
            canonicalChange={quote?.change ?? null}
            volumeStyle={volumeStyle}
          />
        )}
      </div>

      {/* Paneles inferiores globales (RSI/MACD), calculados con estas velas. */}
      {rsiPane && bars.length > 0 && (
        <div className="border-t border-edge p-1">
          <ErrorBoundary variant="panel" label="RSI">
            <MiniIndicatorChart
              title={`RSI (${rsiCfg?.params?.period ?? 14})`}
              series={rsiPane.series}
              referenceLines={rsiPane.referenceLines}
              height={72}
            />
          </ErrorBoundary>
        </div>
      )}
      {macdPane && bars.length > 0 && (
        <div className="border-t border-edge p-1">
          <ErrorBoundary variant="panel" label="MACD">
            <MiniIndicatorChart
              title={`MACD (${macdCfg?.params?.fastPeriod ?? 12},${macdCfg?.params?.slowPeriod ?? 26},${macdCfg?.params?.signalPeriod ?? 9})`}
              series={macdPane.series}
              height={72}
            />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
