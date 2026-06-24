// Calculos puros de indicadores tecnicos sobre velas. Sin dependencias de React
// ni de la libreria de graficas. Faciles de testear.

import type { Candle } from "@/features/charting/chartEngine/ChartEngineAdapter";
import { msToChartTime } from "@/utils/dates";
import type { IndicatorLinePoint } from "./indicatorTypes";

/** SMA simple. Devuelve array alineado a `values` (null donde no hay ventana). */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let acc = 0;
  for (let i = 0; i < values.length; i++) {
    acc += values[i];
    if (i >= period) acc -= values[i - period];
    out.push(i >= period - 1 ? acc / period : null);
  }
  return out;
}

/** EMA. Se inicializa con la SMA del primer bloque. */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** RSI de Wilder. */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const ch = values[i] - values[i - 1];
    gains += Math.max(ch, 0);
    losses += Math.max(-ch, 0);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));
  for (let i = period + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(ch, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-ch, 0)) / period;
    out[i] = 100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss));
  }
  return out;
}

export interface MacdResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? (emaFast[i] as number) - (emaSlow[i] as number) : null
  );
  // Señal: EMA del MACD (solo sobre la parte definida).
  const defined: number[] = [];
  const indexMap: number[] = [];
  macdLine.forEach((v, i) => {
    if (v !== null) {
      defined.push(v);
      indexMap.push(i);
    }
  });
  const signalDefined = ema(defined, signalPeriod);
  const signal: (number | null)[] = new Array(values.length).fill(null);
  indexMap.forEach((origIdx, j) => {
    signal[origIdx] = signalDefined[j];
  });
  const histogram = macdLine.map((v, i) =>
    v !== null && signal[i] !== null ? v - (signal[i] as number) : null
  );
  return { macd: macdLine, signal, histogram };
}

/** Bollinger Bands. */
export function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = mid[i] as number;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { mid, upper, lower };
}

/** Convierte un array de valores alineado a velas en puntos para la grafica. */
export function toLinePoints(candles: Candle[], values: (number | null)[]): IndicatorLinePoint[] {
  const points: IndicatorLinePoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = values[i];
    if (v === null || v === undefined || Number.isNaN(v)) continue;
    points.push({ time: msToChartTime(candles[i].time), value: v });
  }
  return points;
}

export function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}

// ===========================================================================
// API nueva basada en velas completas (time SIEMPRE en Unix ms). La conversion
// a segundos de Lightweight Charts ocurre solo en la frontera de render.
// ===========================================================================

export type PriceSource = "close" | "open" | "high" | "low" | "hl2" | "hlc3" | "ohlc4";

export interface ValuePoint {
  time: number; // Unix ms
  value: number;
}

/** Valor de la fuente elegida para una vela. */
export function getSourceValue(bar: Candle, source: PriceSource = "close"): number {
  switch (source) {
    case "open":
      return bar.open;
    case "high":
      return bar.high;
    case "low":
      return bar.low;
    case "hl2":
      return (bar.high + bar.low) / 2;
    case "hlc3":
      return (bar.high + bar.low + bar.close) / 3;
    case "ohlc4":
      return (bar.open + bar.high + bar.low + bar.close) / 4;
    default:
      return bar.close;
  }
}

function sourceSeries(bars: Candle[], source: PriceSource): number[] {
  return bars.map((b) => getSourceValue(b, source));
}

/** SMA: solo emite puntos con ventana completa y valores finitos. */
export function calculateSMA(
  bars: Candle[],
  params: { period: number; source?: PriceSource }
): ValuePoint[] {
  const period = Math.max(1, Math.floor(params.period));
  const values = sourceSeries(bars, params.source ?? "close");
  const out: ValuePoint[] = [];
  let acc = 0;
  for (let i = 0; i < values.length; i++) {
    acc += values[i];
    if (i >= period) acc -= values[i - period];
    if (i >= period - 1) {
      const v = acc / period;
      if (Number.isFinite(v)) out.push({ time: bars[i].time, value: v });
    }
  }
  return out;
}

/** EMA: alpha = 2/(period+1), sembrada con la SMA del primer bloque. */
export function calculateEMA(
  bars: Candle[],
  params: { period: number; source?: PriceSource }
): ValuePoint[] {
  const period = Math.max(1, Math.floor(params.period));
  const values = sourceSeries(bars, params.source ?? "close");
  if (values.length < period) return [];
  const alpha = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out: ValuePoint[] = [{ time: bars[period - 1].time, value: prev }];
  for (let i = period; i < values.length; i++) {
    prev = values[i] * alpha + prev * (1 - alpha);
    if (Number.isFinite(prev)) out.push({ time: bars[i].time, value: prev });
  }
  return out;
}

export interface BollingerPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

/** Bollinger: basis = SMA; bandas = basis ± stdDev * desviacion rodante. */
export function calculateBollingerBands(
  bars: Candle[],
  params: { period: number; stdDev: number; source?: PriceSource }
): BollingerPoint[] {
  const period = Math.max(1, Math.floor(params.period));
  const mult = params.stdDev > 0 ? params.stdDev : 2;
  const values = sourceSeries(bars, params.source ?? "close");
  const out: BollingerPoint[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    const upper = mean + mult * sd;
    const lower = mean - mult * sd;
    if (Number.isFinite(upper) && Number.isFinite(lower)) {
      out.push({ time: bars[i].time, upper, middle: mean, lower });
    }
  }
  return out;
}

export interface VolumePoint {
  time: number;
  value: number;
  /** true si la vela cerro al alza (close >= open). */
  up: boolean;
}

/** Volumen por vela con direccion (para colorear el histograma). */
export function calculateVolume(bars: Candle[]): VolumePoint[] {
  return bars
    .filter((b) => b.volume != null && Number.isFinite(b.volume))
    .map((b) => ({ time: b.time, value: b.volume as number, up: b.close >= b.open }));
}

/**
 * RSI de Wilder. Casos borde:
 * - avgLoss=0 y avgGain>0 -> 100 ; avgGain=0 y avgLoss>0 -> 0 ; ambos 0 -> 50.
 */
export function calculateRSI(
  bars: Candle[],
  params: { period: number; source?: PriceSource }
): ValuePoint[] {
  const period = Math.max(2, Math.floor(params.period));
  const values = sourceSeries(bars, params.source ?? "close");
  if (values.length <= period) return [];

  const rsiAt = (avgGain: number, avgLoss: number): number => {
    if (avgLoss === 0 && avgGain === 0) return 50;
    if (avgLoss === 0) return 100;
    if (avgGain === 0) return 0;
    return 100 - 100 / (1 + avgGain / avgLoss);
  };

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const ch = values[i] - values[i - 1];
    gains += Math.max(ch, 0);
    losses += Math.max(-ch, 0);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const out: ValuePoint[] = [{ time: bars[period].time, value: rsiAt(avgGain, avgLoss) }];

  for (let i = period + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(ch, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-ch, 0)) / period;
    out.push({ time: bars[i].time, value: rsiAt(avgGain, avgLoss) });
  }
  return out;
}

/**
 * VWAP (Volume Weighted Average Price) con RESET de SESIÓN DIARIA. Pensado para
 * temporalidades intradía: cada día UTC reinicia el acumulado.
 *   typicalPrice = (high + low + close) / 3
 *   VWAP = Σ(typicalPrice·volumen) / Σ(volumen)   (acumulado en el día)
 * Velas sin volumen (null/0): no aportan; arrastran el VWAP previo del día (o se
 * omiten si aún no hay acumulado). Nunca lanza.
 */
export function calculateVWAP(bars: Candle[]): ValuePoint[] {
  const out: ValuePoint[] = [];
  let cumPV = 0;
  let cumV = 0;
  let currentDay = NaN;
  for (const b of bars) {
    const day = Math.floor(b.time / 86_400_000); // día UTC (reset de sesión)
    if (day !== currentDay) {
      cumPV = 0;
      cumV = 0;
      currentDay = day;
    }
    const vol = b.volume;
    if (vol == null || !Number.isFinite(vol) || vol <= 0) {
      // Sin volumen: no rompe; arrastra el VWAP del día si ya hay acumulado.
      if (cumV > 0) out.push({ time: b.time, value: cumPV / cumV });
      continue;
    }
    const typical = (b.high + b.low + b.close) / 3;
    cumPV += typical * vol;
    cumV += vol;
    const v = cumPV / cumV;
    if (Number.isFinite(v)) out.push({ time: b.time, value: v });
  }
  return out;
}

export interface MacdSeriesPoint {
  time: number;
  macd: number;
  signal: number | null;
  histogram: number | null;
}

/** MACD 12/26/9: macd = EMA(fast)-EMA(slow); signal = EMA(macd, signalPeriod). */
export function calculateMACD(
  bars: Candle[],
  params: { fastPeriod: number; slowPeriod: number; signalPeriod: number; source?: PriceSource }
): MacdSeriesPoint[] {
  const fast = Math.max(1, Math.floor(params.fastPeriod));
  const slow = Math.max(1, Math.floor(params.slowPeriod));
  const signalPeriod = Math.max(1, Math.floor(params.signalPeriod));
  if (fast >= slow) return []; // invalido: fast debe ser < slow

  const fastEma = calculateEMA(bars, { period: fast, source: params.source });
  const slowEma = calculateEMA(bars, { period: slow, source: params.source });
  const fastByTime = new Map(fastEma.map((p) => [p.time, p.value]));

  // Linea MACD alineada a la EMA lenta (la mas tardia en arrancar).
  const macdLine: ValuePoint[] = [];
  for (const p of slowEma) {
    const f = fastByTime.get(p.time);
    if (f !== undefined) macdLine.push({ time: p.time, value: f - p.value });
  }

  // Senal: EMA del MACD.
  const signal: (number | null)[] = new Array(macdLine.length).fill(null);
  if (macdLine.length >= signalPeriod) {
    const alpha = 2 / (signalPeriod + 1);
    let prev =
      macdLine.slice(0, signalPeriod).reduce((a, b) => a + b.value, 0) / signalPeriod;
    signal[signalPeriod - 1] = prev;
    for (let i = signalPeriod; i < macdLine.length; i++) {
      prev = macdLine[i].value * alpha + prev * (1 - alpha);
      signal[i] = prev;
    }
  }

  return macdLine.map((p, i) => ({
    time: p.time,
    macd: p.value,
    signal: signal[i],
    histogram: signal[i] === null ? null : p.value - (signal[i] as number),
  }));
}
