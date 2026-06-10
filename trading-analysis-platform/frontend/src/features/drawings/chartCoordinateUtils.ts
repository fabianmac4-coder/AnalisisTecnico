// Conversion entre pixeles del overlay y coordenadas de mercado (time+price),
// usando las APIs de Lightweight Charts. Maneja null en todas las direcciones.

import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { DrawingPoint } from "./drawingTypes";
import { chartTimeToMs, msToChartTime } from "./timeConversion";

export interface LocalPoint {
  x: number;
  y: number;
}

/** Coordenadas del puntero relativas al elemento stage (overlay). */
export function pointerEventToLocalPoint(
  event: { clientX: number; clientY: number },
  stageElement: Element
): LocalPoint {
  const rect = stageElement.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/** Info del ultimo bar real, para estimar tiempos en el area futura. */
export interface FutureConversionInfo {
  lastBarTimeMs: number;
  /** Indice logico del ultimo bar real en la serie. */
  lastBarIndex: number;
  /** Paso entre velas del preset (ms). */
  stepMs: number;
}

/**
 * Pixel del overlay -> DrawingPoint (time en ms, price). Null si no convierte.
 *
 * Con whitespace futuro anexado, coordinateToTime tambien funciona a la derecha
 * del ultimo bar. Como respaldo (mas alla del whitespace), se estima el tiempo
 * con coordinateToLogical + el paso del preset, SOLO hacia el futuro (indices
 * logicos mayores que el ultimo bar real).
 */
export function localPointToDrawingPoint(
  local: LocalPoint,
  chart: IChartApi,
  mainSeries: ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area" | "Histogram">,
  future?: FutureConversionInfo | null
): DrawingPoint | null {
  const price = mainSeries.coordinateToPrice(local.y);
  if (price == null) return null;
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum)) return null;

  const chartTime = chart.timeScale().coordinateToTime(local.x);
  if (chartTime != null) {
    return { time: chartTimeToMs(chartTime), price: priceNum };
  }

  // Fallback futuro: estima el tiempo desde el indice logico.
  if (future) {
    const logical = chart.timeScale().coordinateToLogical(local.x);
    if (logical != null && Number.isFinite(logical) && logical > future.lastBarIndex) {
      const timeMs = future.lastBarTimeMs + (logical - future.lastBarIndex) * future.stepMs;
      if (Number.isFinite(timeMs)) {
        return { time: Math.round(timeMs), price: priceNum };
      }
    }
  }
  return null;
}

/** DrawingPoint (ms) -> pixel del overlay. Null si cae fuera del rango visible. */
export function drawingPointToLocalPoint(
  point: DrawingPoint,
  chart: IChartApi,
  mainSeries: ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area" | "Histogram">
): LocalPoint | null {
  const x = chart.timeScale().timeToCoordinate(msToChartTime(point.time));
  const y = mainSeries.priceToCoordinate(point.price);
  if (x == null || y == null) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** Conversion nativa tiempo(ms) -> x, o null. */
function nativeX(chart: IChartApi, timeMs: number): number | null {
  const x = chart.timeScale().timeToCoordinate(msToChartTime(timeMs));
  return x != null && Number.isFinite(x) ? Number(x) : null;
}

/**
 * Estima x para un timestamp arbitrario interpolando entre las COORDENADAS
 * REALES de las velas del chart destino (no sobre el ancho del contenedor:
 * Lightweight Charts espacia las velas por INDICE, los fines de semana no
 * ocupan espacio y el rango visible incluye whitespace futuro, asi que la
 * interpolacion de calendario sobre el ancho desalineaba los dibujos).
 *
 * Busca la vela anterior y la siguiente al timestamp, toma sus x nativas y
 * interpola entre ellas. Solo para overlays de dibujo.
 */
export function timeMsToCoordinateFromBars(params: {
  timeMs: number;
  chart: IChartApi;
  bars: readonly { time: number }[];
}): number | null {
  const { timeMs, chart, bars } = params;
  if (!Number.isFinite(timeMs) || bars.length === 0) return null;

  // Busqueda binaria del primer bar con time >= timeMs (bars vienen ordenados).
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].time < timeMs) lo = mid + 1;
    else hi = mid;
  }

  if (lo < bars.length && bars[lo].time === timeMs) {
    return nativeX(chart, timeMs);
  }
  // Antes de la primera vela o despues de la ultima: aqui no hay velas entre
  // las que interpolar (el futuro se maneja aparte con el grid de whitespace).
  if (lo === 0 || lo >= bars.length) return null;

  const prev = bars[lo - 1];
  const next = bars[lo];
  const x0 = nativeX(chart, prev.time);
  const x1 = nativeX(chart, next.time);
  if (x0 == null || x1 == null || next.time === prev.time) return null;

  const ratio = (timeMs - prev.time) / (next.time - prev.time);
  return x0 + ratio * (x1 - x0);
}

/**
 * Conversion ROBUSTA de tiempo(ms) -> x para dibujos entre temporalidades.
 *
 * 1. Conversion nativa (exacta si el timestamp existe en la serie, incluido
 *    el whitespace futuro).
 * 2. Si no existe (punto diario sobre escala semanal, intradia sobre diaria...),
 *    interpola entre las coordenadas reales de las velas vecinas del chart
 *    DESTINO. El whitespace futuro NO distorsiona los puntos historicos.
 * 3. Para tiempos posteriores a la ultima vela real, interpola sobre el grid
 *    de whitespace futuro (timestamps `lastBar + k*step`, que SI existen en la
 *    serie) — nunca sobre el ancho bruto del contenedor.
 *
 * Si no hay coordenada segura devuelve null (el dibujo se omite en ese panel).
 */
export function timeMsToCoordinateRobust(params: {
  timeMs: number;
  chart: IChartApi;
  bars: readonly { time: number }[];
  future?: FutureConversionInfo | null;
}): number | null {
  const { timeMs, chart, bars, future } = params;
  if (!Number.isFinite(timeMs)) return null;

  const native = nativeX(chart, timeMs);
  if (native != null) return native;

  const lastBarTime = bars.length > 0 ? bars[bars.length - 1].time : future?.lastBarTimeMs;

  // Historico (hasta la ultima vela real): interpolar entre velas reales.
  if (lastBarTime != null && timeMs <= lastBarTime) {
    return timeMsToCoordinateFromBars({ timeMs, chart, bars });
  }

  // Futuro: interpolar entre los puntos del grid de whitespace que rodean al
  // timestamp (esos timestamps existen en la serie -> conversion nativa).
  if (future && Number.isFinite(future.lastBarTimeMs) && future.stepMs > 0) {
    const k0 = Math.floor((timeMs - future.lastBarTimeMs) / future.stepMs);
    if (k0 < 0) return null;
    const t0 = future.lastBarTimeMs + k0 * future.stepMs;
    const t1 = t0 + future.stepMs;
    const x0 = nativeX(chart, t0);
    const x1 = nativeX(chart, t1);
    if (x0 == null || x1 == null) return null;
    const ratio = (timeMs - t0) / future.stepMs;
    return x0 + ratio * (x1 - x0);
  }

  return null;
}

/**
 * DrawingPoint -> pixel usando la conversion robusta de tiempo. El precio es
 * continuo, asi que priceToCoordinate funciona en cualquier temporalidad.
 */
export function drawingPointToLocalPointRobust(
  point: DrawingPoint,
  chart: IChartApi,
  mainSeries: ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area" | "Histogram">,
  bars: readonly { time: number }[],
  future?: FutureConversionInfo | null
): LocalPoint | null {
  const x = timeMsToCoordinateRobust({ timeMs: point.time, chart, bars, future });
  if (x == null) return null;
  const y = mainSeries.priceToCoordinate(point.price);
  if (y == null || !Number.isFinite(y)) return null;
  return { x, y: Number(y) };
}

/** Distancia (px) de un punto al segmento a-b. Para hit-testing de seleccion. */
export function distancePointToSegment(p: LocalPoint, a: LocalPoint, b: LocalPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
