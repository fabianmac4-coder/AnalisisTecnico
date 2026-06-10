import { useMemo, useState } from "react";
import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { getPreset, type PresetKey } from "@/utils/timeframes";
import { formatPrice, formatPercent, formatVolume } from "@/utils/formatters";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { ChartCanvas } from "./ChartCanvas";
import { ChartTypeSelector } from "./ChartTypeSelector";
import { resolveDisplayPrice } from "./priceResolver";
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

// Franja de diagnostico de datos por panel (solo depuracion): default false.
const SHOW_PANEL_DEBUG_INFO = false;

interface Props {
  preset: PresetKey;
  symbol: string;
  onExpand: (preset: PresetKey) => void;
}

/** Una de las seis graficas del dashboard. Maneja sus propios estados. */
export function ChartPanel({ preset, symbol, onExpand }: Props) {
  const meta = getPreset(preset);
  const data = useChartStore((s) => s.chartDataByPreset[preset]);
  const loading = useChartStore((s) => s.loadingByPreset[preset]);
  const error = useChartStore((s) => s.errorByPreset[preset]);
  const chartType = useChartStore((s) => s.chartTypeByPreset[preset]);
  const setChartType = useChartStore((s) => s.setChartType);

  // Precio canonico: el MISMO en los seis paneles (cotizacion del simbolo,
  // con fallback al ultimo bar de la preset de mayor resolucion disponible).
  const quote = useChartStore((s) => s.quoteBySymbol[symbol]);
  const chartDataByPreset = useChartStore((s) => s.chartDataByPreset);

  const allDrawings = useDrawingStore((s) => s.drawingsBySymbol[symbol]) ?? [];
  const [drawingsVisible, setDrawingsVisible] = useState(true);

  // Filtros globales por temporalidad + colores + indicadores (persistidos).
  const visibilityFilters = useLayoutStore((s) => s.drawingVisibilityFilters);
  const timeframeColors = useLayoutStore((s) => s.timeframeDrawingColors);
  const globalIndicators = useLayoutStore((s) => s.globalIndicators);

  // Dibujos GLOBALES: cualquier dibujo del simbolo se muestra en este panel,
  // salvo que el filtro de su temporalidad de origen este apagado.
  const drawings = useMemo(
    () =>
      drawingsVisible
        ? getVisibleDrawingsForPanel({
            drawings: allDrawings,
            activeSymbol: symbol,
            panelTimeframe: preset,
            visibilityFilters,
          })
        : [],
    [allDrawings, drawingsVisible, preset, symbol, visibilityFilters]
  );

  const bars = data?.bars ?? [];
  const last = bars[bars.length - 1];

  // Indicadores globales calculados con LAS PROPIAS velas de este panel,
  // incluyendo warmup (velas previas ocultas) para que SMA 200 salga completo.
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

  // Paneles inferiores (RSI/MACD) por panel, con sus propias velas.
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

  const { price: displayPrice } = resolveDisplayPrice(quote, chartDataByPreset);
  // El cambio % proviene tambien de la cotizacion canonica (no del bar local).
  const change = quote?.change ?? null;
  const changePct = quote?.changePercent ?? null;
  const currency = quote?.currency ?? data?.currency;
  const changeClass =
    change == null || change === 0 ? "text-muted" : change > 0 ? "text-up" : "text-down";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-edge bg-panel">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 border-b border-edge px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold text-gray-200">{meta.label}</span>
          <span className="rounded bg-panel-3 px-1 text-[10px] text-muted">
            {meta.chartIntervalLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ChartTypeSelector value={chartType} onChange={(t) => setChartType(preset, t)} compact />
          <IconButton
            title={drawingsVisible ? "Ocultar dibujos" : "Mostrar dibujos"}
            active={drawingsVisible}
            onClick={() => setDrawingsVisible((v) => !v)}
          >
            {drawingsVisible ? "👁" : "🚫"}
          </IconButton>
          <IconButton title="Expandir" onClick={() => onExpand(preset)}>
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

      {/* Franja de diagnostico de datos (preset/interval/priceBasis/velas).
          Solo para depurar: DEBE quedar en false. */}
      {import.meta.env.DEV && SHOW_PANEL_DEBUG_INFO && bars.length > 0 && (
        <div className="border-b border-edge px-2 py-0.5 text-[9px] text-muted">
          {preset} · {meta.interval} · {data?.priceBasis ?? "?"} · {bars.length} velas ·{" "}
          {new Date(bars[0].time).toISOString().slice(0, 10)} →{" "}
          {new Date(last!.time).toISOString().slice(0, 10)}
        </div>
      )}

      {/* Cuerpo: grafica o estados */}
      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel/60">
            <Spinner size={22} />
          </div>
        )}
        {error && !loading && (
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
            intraday={meta.intraday}
            showVolume={volumeOn && chartType !== "volume"}
            drawings={drawings}
            symbol={symbol}
            sourceTimeframe={preset}
            editable
            overlays={overlays}
            timeframeColors={timeframeColors}
            canonicalPrice={displayPrice}
            canonicalChange={quote?.change ?? null}
            volumeStyle={volumeStyle}
          />
        )}
      </div>

      {/* Paneles inferiores globales (RSI/MACD), calculados con estas velas.
          Cada uno con su propio limite de error: si falla, no tira el panel. */}
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
