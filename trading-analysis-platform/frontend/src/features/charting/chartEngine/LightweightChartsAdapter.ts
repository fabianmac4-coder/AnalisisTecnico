// Implementacion concreta del ChartEngineAdapter usando Lightweight Charts v4.
//
// Nota de diseño: los DIBUJOS no se renderizan con primitivas de la libreria,
// sino sobre un <canvas> overlay (ver DrawingLayer.tsx) usando las funciones de
// proyeccion tiempo/precio -> pixel que expone esta instancia. Por eso los
// metodos addDrawing/updateDrawing/removeDrawing del adaptador son no-ops:
// existen para cumplir el contrato y permitir una futura migracion a un motor
// que si dibuje primitivas nativas (ej. TradingView Advanced Charts).

import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type {
  Candle,
  ChartEngineAdapter,
  ChartInstance,
  ChartOptions,
  ChartType,
} from "./ChartEngineAdapter";
import { msToChartTime, chartTimeToMs } from "@/features/drawings/timeConversion";

interface ChartHandle {
  id: string;
  chart: IChartApi;
  container: HTMLElement;
  mainSeries: ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area" | "Histogram">;
  volumeSeries?: ISeriesApi<"Histogram">;
  type: ChartType;
  candles: Candle[];
  options: ChartOptions;
  resizeObserver?: ResizeObserver;
  // Precio canonico (unico) mostrado como linea/etiqueta en el eje de precio.
  canonicalPrice: number | null;
  // Cambio diario de la cotizacion: decide el color (verde/rojo/neutro).
  canonicalChange: number | null;
  priceLine?: IPriceLine;
  // Lineas de entradas simuladas (paper trading) sobre la serie principal.
  entryLineRefs?: IPriceLine[];
  // Tiempos futuros (ms) anexados como whitespace tras el ultimo bar real.
  futureTimesMs: number[];
  // Estilo del histograma de volumen (colores por direccion + opacidad).
  volumeStyle: VolumeOverlayStyle;
}

export interface VolumeOverlayStyle {
  positiveColor: string;
  negativeColor: string;
  opacity: number;
  colorByCandleDirection: boolean;
}

const DEFAULT_VOLUME_STYLE: VolumeOverlayStyle = {
  positiveColor: "#22c55e",
  negativeColor: "#ef4444",
  opacity: 0.45,
  colorByCandleDirection: true,
};

/** "#rrggbb" + opacidad 0..1 -> "#rrggbbaa". */
function withAlpha(hex: string, opacity: number): string {
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${a}` : hex;
}

function volumeBarColor(c: Candle, style: VolumeOverlayStyle): string {
  if (!style.colorByCandleDirection) return withAlpha(style.positiveColor, style.opacity);
  return withAlpha(c.close >= c.open ? style.positiveColor : style.negativeColor, style.opacity);
}

// Opciones comunes para que la serie principal NO muestre su propio ultimo
// valor: el "precio actual" lo pinta una sola linea canonica (ver
// applyCanonicalPriceLine). Asi las seis graficas muestran el mismo precio.
const NO_DEFAULT_LAST_VALUE = {
  lastValueVisible: false,
  priceLineVisible: false,
};

const GRID_COLOR = "#1c2230";
const TEXT_COLOR = "#8b93a7";
const UP = "#26a69a";
const DOWN = "#ef5350";

function baseChartOptions(container: HTMLElement) {
  return {
    width: container.clientWidth,
    height: container.clientHeight,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: TEXT_COLOR,
      fontSize: 11,
    },
    grid: {
      vertLines: { color: GRID_COLOR },
      horzLines: { color: GRID_COLOR },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: GRID_COLOR },
    timeScale: { borderColor: GRID_COLOR, timeVisible: true, secondsVisible: false },
  };
}

function createMainSeries(
  chart: IChartApi,
  type: ChartType
): ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area" | "Histogram"> {
  switch (type) {
    case "candlestick":
      return chart.addCandlestickSeries({
        upColor: UP,
        downColor: DOWN,
        borderUpColor: UP,
        borderDownColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
        ...NO_DEFAULT_LAST_VALUE,
      });
    case "bars":
      return chart.addBarSeries({ upColor: UP, downColor: DOWN, ...NO_DEFAULT_LAST_VALUE });
    case "line":
      return chart.addLineSeries({ color: "#3b82f6", lineWidth: 2, ...NO_DEFAULT_LAST_VALUE });
    case "area":
      return chart.addAreaSeries({
        lineColor: "#3b82f6",
        topColor: "rgba(59,130,246,0.4)",
        bottomColor: "rgba(59,130,246,0.02)",
        lineWidth: 2,
        ...NO_DEFAULT_LAST_VALUE,
      });
    case "volume":
      return chart.addHistogramSeries({
        color: "#3b82f6",
        priceFormat: { type: "volume" },
        ...NO_DEFAULT_LAST_VALUE,
      });
  }
}

/**
 * Color de la linea/etiqueta de precio canonica segun el cambio diario:
 * verde si sube, rojo si baja, gris neutro si es 0 o no esta disponible.
 * Exportada (pura) para poder testearla.
 */
export function canonicalPriceLineColor(change: number | null | undefined): string {
  if (change == null || !Number.isFinite(change) || change === 0) return "#e5e7eb";
  return change > 0 ? "#22c55e" : "#ef4444";
}

/** Crea/actualiza/elimina la linea de precio canonica de la serie principal. */
function applyCanonicalPriceLine(handle: ChartHandle): void {
  if (handle.priceLine) {
    handle.mainSeries.removePriceLine(handle.priceLine);
    handle.priceLine = undefined;
  }
  const price = handle.canonicalPrice;
  if (price === null || !Number.isFinite(price)) return;
  handle.priceLine = handle.mainSeries.createPriceLine({
    price,
    color: canonicalPriceLineColor(handle.canonicalChange),
    lineWidth: 1,
    lineStyle: LineStyle.Dotted,
    axisLabelVisible: true,
    // Solo el precio en la etiqueta del eje; sin la palabra "Last".
    title: "",
  });
}

function setMainData(
  series: ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area" | "Histogram">,
  type: ChartType,
  candles: Candle[],
  futureTimesMs: number[] = []
): void {
  // Whitespace futuro: SOLO { time }, sin OHLC/volumen. Habilita clicks y
  // coordenadas en el area posterior al ultimo bar real, sin velas falsas.
  const whitespace = futureTimesMs.map((t) => ({ time: msToChartTime(t) as UTCTimestamp }));

  if (type === "candlestick" || type === "bars") {
    series.setData([
      ...candles.map((c) => ({
        time: msToChartTime(c.time) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
      ...whitespace,
    ]);
  } else if (type === "volume") {
    series.setData([
      ...candles.map((c) => ({
        time: msToChartTime(c.time) as UTCTimestamp,
        value: c.volume ?? 0,
        color: c.close >= c.open ? "rgba(38,166,154,0.6)" : "rgba(239,83,80,0.6)",
      })),
      ...whitespace,
    ]);
  } else {
    // line / area
    series.setData([
      ...candles.map((c) => ({ time: msToChartTime(c.time) as UTCTimestamp, value: c.close })),
      ...whitespace,
    ]);
  }
}

export class LightweightChartsAdapter implements ChartEngineAdapter {
  private handles = new Map<string, ChartHandle>();
  private counter = 0;

  createChart(container: HTMLElement, options: ChartOptions): ChartInstance {
    const id = `chart_${++this.counter}`;
    const chart = createChart(container, baseChartOptions(container));

    const type: ChartType = "candlestick";
    const mainSeries = createMainSeries(chart, type);

    const handle: ChartHandle = {
      id,
      chart,
      container,
      mainSeries,
      type,
      candles: [],
      options,
      canonicalPrice: null,
      canonicalChange: null,
      futureTimesMs: [],
      volumeStyle: { ...DEFAULT_VOLUME_STYLE },
    };

    // Volumen como overlay inferior (cuando aplica y el tipo no es volume).
    if (options.showVolume) {
      this.ensureVolumeOverlay(handle);
    }

    // Redimensionado automatico.
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    ro.observe(container);
    handle.resizeObserver = ro;

    this.handles.set(id, handle);
    return this.makeInstance(handle);
  }

  private ensureVolumeOverlay(handle: ChartHandle): void {
    if (handle.type === "volume") return; // ya es histograma principal
    if (handle.volumeSeries) return;
    const vol = handle.chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      ...NO_DEFAULT_LAST_VALUE,
    });
    handle.chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    handle.volumeSeries = vol;
  }

  private makeInstance(handle: ChartHandle): ChartInstance {
    return {
      id: handle.id,
      toPixel: (timeMs, price) => {
        const x = handle.chart
          .timeScale()
          .timeToCoordinate(msToChartTime(timeMs) as UTCTimestamp);
        const y = handle.mainSeries.priceToCoordinate(price);
        return { x: x ?? null, y: y ?? null };
      },
      toMarket: (x, y) => {
        const t = handle.chart.timeScale().coordinateToTime(x);
        const price = handle.mainSeries.coordinateToPrice(y);
        return {
          time: t === null ? null : chartTimeToMs(t),
          price: price ?? null,
        };
      },
      onViewportChange: (cb) => {
        const ts = handle.chart.timeScale();
        ts.subscribeVisibleLogicalRangeChange(cb);
        // Tambien repintar al mover crosshair/resize.
        handle.chart.subscribeCrosshairMove(cb);
        return () => {
          ts.unsubscribeVisibleLogicalRangeChange(cb);
          handle.chart.unsubscribeCrosshairMove(cb);
        };
      },
      onClick: (cb) => {
        const handler = (param: { point?: { x: number; y: number } }) => {
          if (param.point) cb(param.point.x, param.point.y);
        };
        handle.chart.subscribeClick(handler);
        return () => handle.chart.unsubscribeClick(handler);
      },
      getContainer: () => handle.container,
      getChartApi: () => handle.chart,
      getMainSeries: () => handle.mainSeries,
      setInteractionEnabled: (enabled) => {
        handle.chart.applyOptions({
          handleScroll: enabled,
          handleScale: enabled,
        });
      },
      getVisibleTimeRangeMs: () => {
        const range = handle.chart.timeScale().getVisibleRange();
        if (!range || range.from == null || range.to == null) return null;
        return { startMs: chartTimeToMs(range.from), endMs: chartTimeToMs(range.to) };
      },
      setCanonicalPriceLine: (price, change = null) => {
        handle.canonicalPrice = price;
        handle.canonicalChange = change;
        applyCanonicalPriceLine(handle);
      },
      setSimulatedEntryLines: (lines) => {
        // Quita las lineas previas (try/catch: la serie pudo recrearse al
        // cambiar el tipo de grafica y las refs viejas ya no existen).
        for (const ref of handle.entryLineRefs ?? []) {
          try {
            handle.mainSeries.removePriceLine(ref);
          } catch {
            /* serie recreada */
          }
        }
        handle.entryLineRefs = lines.map((l) =>
          handle.mainSeries.createPriceLine({
            price: l.price,
            color: l.color || "#22c55e",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: l.title || "Sim Entry",
          })
        );
      },
    };
  }

  setData(chartId: string, bars: Candle[], futureTimesMs: number[] = []): void {
    const handle = this.handles.get(chartId);
    if (!handle) return;
    handle.candles = bars;
    handle.futureTimesMs = futureTimesMs;
    setMainData(handle.mainSeries, handle.type, bars, futureTimesMs);
    this.refreshVolumeData(handle);
    handle.chart.timeScale().fitContent();
  }

  private refreshVolumeData(handle: ChartHandle): void {
    if (!handle.volumeSeries) return;
    handle.volumeSeries.setData(
      handle.candles.map((c) => ({
        time: msToChartTime(c.time) as UTCTimestamp,
        value: c.volume ?? 0,
        color: volumeBarColor(c, handle.volumeStyle),
      }))
    );
  }

  /**
   * Muestra/oculta el histograma de volumen DINAMICAMENTE (toggle global).
   * Antes solo se decidia al crear el chart, por eso el toggle "no hacia nada".
   */
  setVolumeVisible(chartId: string, visible: boolean, style?: VolumeOverlayStyle): void {
    const handle = this.handles.get(chartId);
    if (!handle) return;
    if (style) handle.volumeStyle = style;

    if (!visible) {
      if (handle.volumeSeries) {
        handle.chart.removeSeries(handle.volumeSeries);
        handle.volumeSeries = undefined;
      }
      return;
    }
    if (handle.type === "volume") return; // el volumen YA es la serie principal
    if (!handle.volumeSeries) {
      this.ensureVolumeOverlay(handle);
    }
    this.refreshVolumeData(handle);
  }

  setChartType(chartId: string, type: ChartType): void {
    const handle = this.handles.get(chartId);
    if (!handle || handle.type === type) return;
    handle.chart.removeSeries(handle.mainSeries);
    // La serie anterior se fue: su priceLine tambien. Limpiamos la referencia.
    handle.priceLine = undefined;
    handle.mainSeries = createMainSeries(handle.chart, type);
    handle.type = type;
    setMainData(handle.mainSeries, type, handle.candles, handle.futureTimesMs);
    // Re-crea la linea de precio canonica sobre la nueva serie.
    applyCanonicalPriceLine(handle);
  }

  // Los dibujos se pintan en el overlay (DrawingLayer); ver nota de cabecera.
  addDrawing(): void {
    /* no-op intencional */
  }
  updateDrawing(): void {
    /* no-op intencional */
  }
  removeDrawing(): void {
    /* no-op intencional */
  }

  /** Acceso a la serie principal para indicadores overlay (uso interno UI). */
  getChartApi(chartId: string): IChartApi | undefined {
    return this.handles.get(chartId)?.chart;
  }

  destroy(chartId: string): void {
    const handle = this.handles.get(chartId);
    if (!handle) return;
    handle.resizeObserver?.disconnect();
    handle.chart.remove();
    this.handles.delete(chartId);
  }
}
