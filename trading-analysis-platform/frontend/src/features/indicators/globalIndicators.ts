// Indicadores globales: se activan/editan UNA vez y se aplican a las seis
// graficas. CADA panel calcula el indicador con SUS PROPIAS velas (RSI 14 en
// 4Y_1W son 14 semanas; en 1W_30M son 14 velas de 30 min).
//
// Warmup: los calculos usan [warmupBars + velas visibles] para que SMA 200 y
// similares aparezcan completos; la salida se FILTRA al rango visible antes de
// pintarse (las velas de warmup nunca se ven como candles).

import type { Candle } from "@/features/charting/chartEngine/ChartEngineAdapter";
import type { OverlayLine } from "@/features/charting/ChartCanvas";
import { msToChartTime } from "@/features/drawings/timeConversion";
import {
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  type PriceSource,
  type ValuePoint,
} from "./indicatorCalculations";

export type IndicatorType = "SMA" | "EMA" | "BBANDS" | "VOLUME" | "RSI" | "MACD";

export interface IndicatorStyle {
  color?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  histogramPositiveColor?: string;
  histogramNegativeColor?: string;
  lineWidth?: number;
  opacity?: number;
}

export interface GlobalIndicatorConfig {
  id: string;
  type: IndicatorType;
  name: string;
  visible: boolean;
  applyToAllTimeframes: boolean;
  params: Record<string, number | string | boolean>;
  style: IndicatorStyle;
}

export const DEFAULT_GLOBAL_INDICATORS: GlobalIndicatorConfig[] = [
  {
    id: "volume",
    type: "VOLUME",
    name: "Volume",
    visible: true,
    applyToAllTimeframes: true,
    params: { colorByCandleDirection: true },
    style: {
      histogramPositiveColor: "#22c55e",
      histogramNegativeColor: "#ef4444",
      opacity: 0.45,
    },
  },
  {
    id: "sma-20",
    type: "SMA",
    name: "SMA 20",
    visible: false,
    applyToAllTimeframes: true,
    params: { period: 20, source: "close" },
    style: { color: "#60a5fa", lineWidth: 1 },
  },
  {
    id: "sma-50",
    type: "SMA",
    name: "SMA 50",
    visible: false,
    applyToAllTimeframes: true,
    params: { period: 50, source: "close" },
    style: { color: "#f59e0b", lineWidth: 1 },
  },
  {
    id: "sma-200",
    type: "SMA",
    name: "SMA 200",
    visible: false,
    applyToAllTimeframes: true,
    params: { period: 200, source: "close" },
    style: { color: "#ef4444", lineWidth: 1 },
  },
  {
    id: "ema-9",
    type: "EMA",
    name: "EMA 9",
    visible: false,
    applyToAllTimeframes: true,
    params: { period: 9, source: "close" },
    style: { color: "#22c55e", lineWidth: 1 },
  },
  {
    id: "ema-21",
    type: "EMA",
    name: "EMA 21",
    visible: false,
    applyToAllTimeframes: true,
    params: { period: 21, source: "close" },
    style: { color: "#a855f7", lineWidth: 1 },
  },
  {
    id: "bbands-20-2",
    type: "BBANDS",
    name: "Bollinger Bands",
    visible: false,
    applyToAllTimeframes: true,
    params: { period: 20, stdDev: 2, source: "close" },
    style: {
      color: "#38bdf8",
      secondaryColor: "#64748b",
      tertiaryColor: "#38bdf8",
      lineWidth: 1,
      opacity: 0.8,
    },
  },
  {
    id: "rsi-14",
    type: "RSI",
    name: "RSI 14",
    visible: false,
    applyToAllTimeframes: true,
    params: { period: 14, source: "close", overbought: 70, oversold: 30 },
    style: { color: "#c084fc", lineWidth: 1 },
  },
  {
    id: "macd-12-26-9",
    type: "MACD",
    name: "MACD",
    visible: false,
    applyToAllTimeframes: true,
    params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, source: "close" },
    style: {
      color: "#60a5fa",
      secondaryColor: "#f59e0b",
      histogramPositiveColor: "#22c55e",
      histogramNegativeColor: "#ef4444",
      lineWidth: 1,
      opacity: 0.6,
    },
  },
];

// Ids del modelo anterior -> ids nuevos (migracion de configs persistidas).
const LEGACY_ID_MAP: Record<string, string> = {
  VOLUME: "volume",
  SMA_20: "sma-20",
  SMA_50: "sma-50",
  SMA_200: "sma-200",
  EMA_9: "ema-9",
  EMA_21: "ema-21",
  RSI: "rsi-14",
  MACD: "macd-12-26-9",
};

/**
 * Normaliza configs persistidas (de cualquier version) al modelo actual:
 * conserva visibilidad/params/estilo donde el id coincide (o su id legado) y
 * completa el resto con los defaults. Nunca pierde indicadores nuevos.
 */
export function normalizeIndicatorConfigs(stored: unknown): GlobalIndicatorConfig[] {
  const list = Array.isArray(stored) ? (stored as Partial<GlobalIndicatorConfig>[]) : [];
  const byId = new Map<string, Partial<GlobalIndicatorConfig>>();
  for (const item of list) {
    if (!item || typeof item.id !== "string") continue;
    byId.set(LEGACY_ID_MAP[item.id] ?? item.id, item);
  }
  return DEFAULT_GLOBAL_INDICATORS.map((def) => {
    const prev = byId.get(def.id);
    if (!prev) return { ...def, params: { ...def.params }, style: { ...def.style } };
    return {
      ...def,
      visible: typeof prev.visible === "boolean" ? prev.visible : def.visible,
      // Solo conserva params/estilo si vienen del modelo nuevo (tiene name).
      params: prev.name ? { ...def.params, ...prev.params } : { ...def.params },
      style: prev.name ? { ...def.style, ...prev.style } : { ...def.style },
    };
  });
}

/** Valida params de un indicador. Devuelve mensaje de error o null si es valido. */
export function validateIndicatorParams(
  type: IndicatorType,
  params: Record<string, number | string | boolean>
): string | null {
  const int = (v: unknown) => Number.isInteger(Number(v)) && Number(v) >= 1;
  switch (type) {
    case "SMA":
    case "EMA":
      if (!int(params.period)) return "period debe ser un entero >= 1";
      return null;
    case "BBANDS":
      if (!int(params.period)) return "period debe ser un entero >= 1";
      if (!(Number(params.stdDev) > 0)) return "stdDev debe ser > 0";
      return null;
    case "RSI":
      if (!Number.isInteger(Number(params.period)) || Number(params.period) < 2)
        return "period debe ser un entero >= 2";
      return null;
    case "MACD": {
      if (!int(params.fastPeriod) || !int(params.slowPeriod) || !int(params.signalPeriod))
        return "los periodos deben ser enteros >= 1";
      if (Number(params.fastPeriod) >= Number(params.slowPeriod))
        return "fastPeriod debe ser menor que slowPeriod";
      return null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Builders por panel: reciben TODAS las velas (warmup + visibles) y el inicio
// del rango visible; emiten datos listos para la grafica (tiempo en segundos).
// ---------------------------------------------------------------------------

function toChartPoints(points: ValuePoint[], visibleFromMs: number) {
  return points
    .filter((p) => p.time >= visibleFromMs)
    .map((p) => ({ time: msToChartTime(p.time) as number, value: p.value }));
}

function src(params?: Record<string, number | string | boolean>): PriceSource {
  return (params?.source as PriceSource) ?? "close";
}

/** Lectura defensiva de un numero de params (estado persistido puede ser viejo). */
function num(
  params: Record<string, number | string | boolean> | undefined,
  key: string,
  fallback: number
): number {
  const v = Number(params?.[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Overlays sobre el precio (SMA/EMA/Bollinger) para UN panel. */
export function buildPriceOverlays(
  allBars: Candle[],
  visibleFromMs: number,
  indicators: GlobalIndicatorConfig[]
): OverlayLine[] {
  if (allBars.length === 0) return [];
  const out: OverlayLine[] = [];

  for (const ind of indicators) {
    if (!ind?.visible) continue;
    const style = ind.style ?? {};
    const width = style.lineWidth ?? 1;

    if (ind.type === "SMA" || ind.type === "EMA") {
      const calc = ind.type === "SMA" ? calculateSMA : calculateEMA;
      const points = calc(allBars, {
        period: num(ind.params, "period", 20),
        source: src(ind.params),
      });
      out.push({
        id: ind.id,
        color: style.color ?? "#888888",
        lineWidth: width,
        points: toChartPoints(points, visibleFromMs),
      });
    } else if (ind.type === "BBANDS") {
      const bb = calculateBollingerBands(allBars, {
        period: num(ind.params, "period", 20),
        stdDev: num(ind.params, "stdDev", 2),
        source: src(ind.params),
      });
      const vis = bb.filter((p) => p.time >= visibleFromMs);
      const line = (suffix: string, color: string, key: "upper" | "middle" | "lower") => ({
        id: `${ind.id}-${suffix}`,
        color,
        lineWidth: width,
        points: vis.map((p) => ({ time: msToChartTime(p.time) as number, value: p[key] })),
      });
      out.push(
        line("upper", style.color ?? "#38bdf8", "upper"),
        line("middle", style.secondaryColor ?? "#64748b", "middle"),
        line("lower", style.tertiaryColor ?? style.color ?? "#38bdf8", "lower")
      );
    }
  }
  return out;
}

export interface PanePoint {
  time: number; // segundos (listo para la grafica)
  value: number;
  color?: string;
}

export interface PaneSeries {
  id: string;
  color: string;
  type?: "line" | "histogram";
  points: PanePoint[];
}

export interface PaneData {
  series: PaneSeries[];
  referenceLines?: { value: number; color: string }[];
}

/** Panel inferior RSI (con lineas de referencia overbought/oversold). */
export function buildRsiPane(
  allBars: Candle[],
  visibleFromMs: number,
  cfg: GlobalIndicatorConfig
): PaneData {
  const points = calculateRSI(allBars, {
    period: num(cfg.params, "period", 14),
    source: src(cfg.params),
  });
  return {
    series: [
      {
        id: cfg.id,
        color: cfg.style?.color ?? "#c084fc",
        type: "line",
        points: toChartPoints(points, visibleFromMs),
      },
    ],
    referenceLines: [
      { value: num(cfg.params, "overbought", 70), color: "#ef4444" },
      { value: 50, color: "#475569" },
      { value: num(cfg.params, "oversold", 30), color: "#22c55e" },
    ],
  };
}

/** Panel inferior MACD (linea, senal e histograma coloreado por signo). */
export function buildMacdPane(
  allBars: Candle[],
  visibleFromMs: number,
  cfg: GlobalIndicatorConfig
): PaneData {
  const style = cfg.style ?? {};
  const macd = calculateMACD(allBars, {
    fastPeriod: num(cfg.params, "fastPeriod", 12),
    slowPeriod: num(cfg.params, "slowPeriod", 26),
    signalPeriod: num(cfg.params, "signalPeriod", 9),
    source: src(cfg.params),
  });
  const vis = macd.filter((p) => p.time >= visibleFromMs);
  const pos = style.histogramPositiveColor ?? "#22c55e";
  const neg = style.histogramNegativeColor ?? "#ef4444";
  const opacityHex = Math.round((style.opacity ?? 0.6) * 255)
    .toString(16)
    .padStart(2, "0");
  return {
    series: [
      {
        id: `${cfg.id}-hist`,
        color: pos,
        type: "histogram",
        points: vis
          .filter((p) => p.histogram !== null)
          .map((p) => ({
            time: msToChartTime(p.time) as number,
            value: p.histogram as number,
            color: `${(p.histogram as number) >= 0 ? pos : neg}${opacityHex}`,
          })),
      },
      {
        id: `${cfg.id}-line`,
        color: style.color ?? "#60a5fa",
        type: "line",
        points: vis.map((p) => ({ time: msToChartTime(p.time) as number, value: p.macd })),
      },
      {
        id: `${cfg.id}-signal`,
        color: style.secondaryColor ?? "#f59e0b",
        type: "line",
        points: vis
          .filter((p) => p.signal !== null)
          .map((p) => ({ time: msToChartTime(p.time) as number, value: p.signal as number })),
      },
    ],
  };
}

export function findIndicator(
  indicators: GlobalIndicatorConfig[],
  type: IndicatorType
): GlobalIndicatorConfig | undefined {
  return indicators.find((i) => i.type === type);
}

export function isVolumeEnabled(indicators: GlobalIndicatorConfig[]): boolean {
  return indicators.some((i) => i.type === "VOLUME" && i.visible);
}

export interface VolumeStyle {
  positiveColor: string;
  negativeColor: string;
  opacity: number;
  colorByCandleDirection: boolean;
}

export function getVolumeStyle(indicators: GlobalIndicatorConfig[]): VolumeStyle {
  const cfg = findIndicator(indicators, "VOLUME");
  return {
    positiveColor: cfg?.style?.histogramPositiveColor ?? "#22c55e",
    negativeColor: cfg?.style?.histogramNegativeColor ?? "#ef4444",
    opacity: cfg?.style?.opacity ?? 0.45,
    colorByCandleDirection: Boolean(cfg?.params?.colorByCandleDirection ?? true),
  };
}
