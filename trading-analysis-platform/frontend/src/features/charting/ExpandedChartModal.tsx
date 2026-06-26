import { useMemo } from "react";
import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { useLayoutStore } from "@/stores/layoutStore";
import {
  INTERVAL_LABEL,
  RANGE_LABEL,
  ORIGIN_SLOT_IDS,
  isIntradayInterval,
  slotSourceTimeframe,
  type ChartSlotConfig,
} from "@/features/charts/chartWorkspaceTypes";
import {
  useDrawingOriginVisibilityStore,
  originVisKey,
} from "@/features/drawings/drawingOriginVisibilityStore";
import {
  useDrawingStyleStore,
  panelStyleKey,
  defaultColorForSlot,
  DEFAULT_PANEL_STYLE,
} from "@/features/drawings/drawingStyleStore";
import {
  useChartWorkspaceStore,
  selectActiveWorkspace,
} from "@/features/charts/chartWorkspaceStore";
import { SlotConfigSelector } from "@/features/charts/SlotConfigSelector";
import { ChartCanvas } from "./ChartCanvas";
import { ChartTypeSelector } from "./ChartTypeSelector";
import { DrawingToolbar } from "@/features/drawings/DrawingToolbar";
import { duplicateSelectedDrawing } from "@/features/drawings/drawingClipboard";
import { getVisibleDrawingsForPanel } from "@/features/drawings/drawingFilters";
import { useRefreshStore } from "@/features/refresh/refreshStore";
import { ReplayControls } from "@/features/replay/ReplayControls";
import { useReplayStore } from "@/features/replay/replayStore";
import { filterBarsToCursor } from "@/features/replay/replayUtils";
import { resolveDisplayPriceFromSlots } from "./priceResolver";
import { MiniIndicatorChart } from "@/features/indicators/MiniIndicatorChart";
import { IndicatorToolbar } from "@/features/indicators/IndicatorToolbar";
import {
  buildPriceOverlays,
  buildRsiPane,
  buildMacdPane,
  findIndicator,
  isVolumeEnabled,
  getVolumeStyle,
} from "@/features/indicators/globalIndicators";

interface Props {
  slot: ChartSlotConfig;
  symbol: string;
  onClose: () => void;
  /** Las seis gráficas del workspace (para el selector de gráfica maximizada). */
  slots?: ChartSlotConfig[];
  /** Cambia la gráfica maximizada SIN cerrar el modo maximizado. */
  onSelectSlot?: (slotId: string) => void;
}

/** Vista ampliada (maximizada) de una gráfica: barra de herramientas completa
 *  (rango/intervalo, actualizar, replay, dibujo + color + duplicar) e
 *  indicadores con el MISMO estado global que el panel normal. */
export function ExpandedChartModal({
  slot,
  symbol,
  onClose,
  slots = [slot],
  onSelectSlot,
}: Props) {
  const sourceTimeframe = slotSourceTimeframe(slot);
  const metaLabel = `${RANGE_LABEL[slot.range]} / ${INTERVAL_LABEL[slot.interval]}`;
  const slotIndex = Math.max(0, slots.findIndex((s) => s.slotId === slot.slotId));
  const intraday = isIntradayInterval(slot.interval);
  const c030Id = useChartWorkspaceStore(
    (s) => selectActiveWorkspace(s, symbol)?.c030Id
  );
  const data = useChartStore((s) => s.chartDataBySlot[slot.slotId]);
  const loading = useChartStore((s) => s.loadingBySlot[slot.slotId]);
  const chartType = useChartStore((s) => s.chartTypeBySlot[slot.slotId]) ?? "candlestick";
  const setSlotChartType = useChartStore((s) => s.setSlotChartType);
  const reloadSlot = useChartStore((s) => s.reloadSlot);
  const updateChartSlot = useChartWorkspaceStore((s) => s.updateChartSlot);
  const refreshNow = useRefreshStore((s) => s.refreshNow);
  const isRefreshing = useRefreshStore((s) => s.isRefreshing);
  const quote = useChartStore((s) => s.quoteBySymbol[symbol]);
  const chartDataBySlot = useChartStore((s) => s.chartDataBySlot);
  const baseCanonicalPrice = resolveDisplayPriceFromSlots(quote, Object.values(chartDataBySlot));
  const allDrawings = useDrawingStore((s) => s.drawingsBySymbol[symbol]) ?? [];
  const timeframeColors = useLayoutStore((s) => s.timeframeDrawingColors);
  // Indicadores GLOBALES (mismo estado que el panel normal: respeta memoria).
  const globalIndicators = useLayoutStore((s) => s.globalIndicators);

  // Estilo de dibujo POR PANEL (mismo store que el panel normal). El color del
  // maximizado y el de Gráfica N son EL MISMO (clave c030Id:slotId).
  const styleKey = panelStyleKey(c030Id, slot.slotId);
  const panelStyle =
    useDrawingStyleStore((s) => s.panelStyles[styleKey]) ?? {
      ...DEFAULT_PANEL_STYLE,
      color: defaultColorForSlot(slot.slotId),
    };
  const setPanelStyle = useDrawingStyleStore((s) => s.setPanelStyle);

  // Modo Replay: oculta velas posteriores al cursor también en la vista ampliada.
  const replayEnabled = useReplayStore((s) => s.enabled);
  const replayCursor = useReplayStore((s) => s.cursorTime);
  const replaySelecting = useReplayStore((s) => s.selecting);
  const setReplayCursor = useReplayStore((s) => s.setCursor);
  const replayActive = replayEnabled && replayCursor != null;

  function handleSlotChange(
    range: ChartSlotConfig["range"],
    interval: ChartSlotConfig["interval"]
  ) {
    if (c030Id != null) {
      void updateChartSlot(symbol, c030Id, slot.slotId, range, interval);
    }
    void reloadSlot(symbol, { ...slot, range, interval });
  }

  const fullBars = data?.bars ?? [];
  const bars = replayActive ? filterBarsToCursor(fullBars, replayCursor) : fullBars;
  const replayReferenceTimes = useMemo(() => fullBars.map((b) => b.time), [fullBars]);
  // Velas para CÁLCULO de indicadores = warmup + visibles (replay-filtradas).
  const allBars = useMemo(() => {
    const warmup = data?.warmupBars ?? [];
    const w = replayActive ? filterBarsToCursor(warmup, replayCursor) : warmup;
    return [...w, ...bars];
  }, [data?.warmupBars, bars, replayActive, replayCursor]);
  const visibleFromMs = data?.visibleFrom ?? fullBars[0]?.time ?? 0;

  // En Replay el precio mostrado es el de la última vela visible (no el actual).
  const canonicalPrice = replayActive
    ? bars[bars.length - 1]?.close ?? null
    : baseCanonicalPrice;

  const originHidden = useDrawingOriginVisibilityStore((s) => s.hidden);
  const hiddenOrigins = useMemo(() => {
    const set = new Set<string>();
    for (const sid of ORIGIN_SLOT_IDS) {
      if (originHidden[originVisKey(c030Id, symbol, sid)]) set.add(sid);
    }
    return set;
  }, [originHidden, c030Id, symbol]);
  const drawings = getVisibleDrawingsForPanel({
    drawings: allDrawings,
    activeSymbol: symbol,
    hiddenOrigins,
  });

  // Overlays/volumen/RSI/MACD desde los indicadores GLOBALES (no estado local).
  const overlays = useMemo(
    () => buildPriceOverlays(allBars, visibleFromMs, globalIndicators, intraday),
    [allBars, visibleFromMs, globalIndicators, intraday]
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
    () => (macdCfg?.visible && allBars.length > 0 ? buildMacdPane(allBars, visibleFromMs, macdCfg) : null),
    [allBars, visibleFromMs, macdCfg]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-3">
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-edge bg-panel">
        {/* Header: título + rango/intervalo + tipo + color + duplicar + actualizar + cerrar. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-100">
              Gráfica {slotIndex + 1} · {symbol} · {metaLabel}
            </span>
            {/* Selector de gráfica: cambiar de Gráfica 1..6 SIN cerrar maximizado. */}
            {slots.length > 1 && (
              <div
                className="flex items-center gap-0.5"
                data-testid="expanded-slot-selector"
                title="Gráfica"
              >
                {slots.map((s, i) => {
                  const active = s.slotId === slot.slotId;
                  return (
                    <button
                      key={s.slotId}
                      onClick={() => onSelectSlot?.(s.slotId)}
                      data-testid={`expanded-slot-${s.slotId}`}
                      title={`Gráfica ${i + 1}`}
                      className={`rounded px-2 py-0.5 text-[11px] ${
                        active
                          ? "bg-accent text-white"
                          : "bg-panel-3 text-muted hover:bg-edge"
                      }`}
                    >
                      G{i + 1}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Rango / intervalo de ESTA gráfica (persiste en C030 y recarga). */}
            <SlotConfigSelector
              range={slot.range}
              interval={slot.interval}
              disabled={!!loading}
              onChange={handleSlotChange}
            />
            <ChartTypeSelector value={chartType} onChange={(t) => setSlotChartType(slot.slotId, t)} />
            {/* Color de línea de los dibujos nuevos de ESTA gráfica (mismo store
                que el panel normal: clave c030Id:slotId). */}
            <label
              title="Color de línea"
              data-testid="expanded-drawing-color"
              className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded"
            >
              <span
                className="h-4 w-4 rounded-full ring-1 ring-black/40"
                style={{ backgroundColor: panelStyle.color }}
              />
              <input
                type="color"
                aria-label="Color de línea"
                value={panelStyle.color}
                onChange={(e) => setPanelStyle(c030Id, slot.slotId, { color: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <button
              onClick={() => void duplicateSelectedDrawing(symbol)}
              data-testid="expanded-duplicate"
              title="Duplicar el dibujo seleccionado (Ctrl+C / Ctrl+V)"
              className="rounded bg-panel-3 px-2 py-1 text-xs text-gray-200 hover:bg-edge"
            >
              ⎘ Duplicar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void refreshNow(symbol)}
              disabled={isRefreshing}
              data-testid="expanded-refresh"
              title="Actualizar datos de mercado"
              className="rounded bg-panel-3 px-3 py-1 text-xs text-gray-200 hover:bg-edge disabled:opacity-50"
            >
              {isRefreshing ? "Actualizando…" : "⟳ Actualizar"}
            </button>
            <button
              onClick={onClose}
              data-testid="expanded-close"
              className="rounded bg-panel-3 px-3 py-1 text-xs hover:bg-edge"
            >
              Cerrar maximizado ✕
            </button>
          </div>
        </div>

        {/* Controles de Modo Replay (también disponibles maximizado). */}
        <div className="flex items-center gap-2 border-b border-edge px-3 py-1.5">
          <ReplayControls symbol={symbol} referenceTimes={replayReferenceTimes} />
        </div>

        {/* Indicadores: MISMO control global que el dashboard (respeta memoria). */}
        <IndicatorToolbar />

        {/* Cuerpo */}
        <div className="flex flex-1 overflow-hidden">
          <DrawingToolbar />
          <div className="flex flex-1 flex-col gap-2 overflow-auto p-2">
            <div className="min-h-[320px] flex-1">
              {bars.length > 0 ? (
                <ChartCanvas
                  key={slot.slotId}
                  candles={bars}
                  chartType={chartType}
                  intraday={intraday}
                  showVolume={volumeOn && chartType !== "volume"}
                  drawings={drawings}
                  symbol={symbol}
                  sourceTimeframe={sourceTimeframe}
                  c030Id={c030Id}
                  slotId={slot.slotId}
                  editable
                  overlays={overlays}
                  timeframeColors={timeframeColors}
                  canonicalPrice={canonicalPrice}
                  canonicalChange={replayActive ? null : quote?.change ?? null}
                  volumeStyle={volumeStyle}
                  exchangeTimezone={data?.exchangeTimezone ?? data?.timezone}
                  onChartClick={
                    replayEnabled && replaySelecting ? setReplayCursor : undefined
                  }
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted">Sin datos</div>
              )}
            </div>
            {rsiPane && bars.length > 0 && (
              <MiniIndicatorChart
                title={`RSI (${rsiCfg?.params?.period ?? 14})`}
                series={rsiPane.series}
                referenceLines={rsiPane.referenceLines}
              />
            )}
            {macdPane && bars.length > 0 && (
              <MiniIndicatorChart
                title={`MACD (${macdCfg?.params?.fastPeriod ?? 12},${macdCfg?.params?.slowPeriod ?? 26},${macdCfg?.params?.signalPeriod ?? 9})`}
                series={macdPane.series}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
