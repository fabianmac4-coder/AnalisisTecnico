// Auto-deteccion de canales a partir de las lineas dibujadas por el usuario
// (free_line / extended_trendline / dotted_line). Matematica PURA: tiempos en
// MILISEGUNDOS Unix.
//
// REGLA DE PRODUCTO: la deteccion automatica es POR TEMPORALIDAD. Cuando se
// pasa `options.timeframe`, SOLO se consideran dibujos cuyo sourceTimeframe
// (TemporalidadOrigen) coincide EXACTAMENTE con esa temporalidad, aunque el
// dibujo sea visible en todas (showOnAllTimeframes solo controla el render).
// Un canal dibujado en 4Y_1W jamas debe calcular R/R en 1Y_1D ni viceversa.
//
// Un par de lineas es un canal si: angulos similares (en coordenadas
// NORMALIZADAS, no pendiente cruda en ms), ancho razonable y precio de
// referencia dentro del canal o cerca (tolerancia). NO se exige solape
// temporal: los canales suelen dibujarse con inicios/finales distintos y
// ambas lineas se EXTRAPOLAN al tiempo de referencia.

import type { Drawing } from "@/features/drawings/drawingTypes";
import { computeChannelRiskReward, getLinePriceAtTime } from "./channelRiskRewardMath";
import type { ChannelLine, ChannelRiskRewardResult } from "./channelRiskRewardTypes";

// Tolerancias DELIBERADAMENTE laxas: mejor detectar un canal imperfecto que
// rechazar uno obvio (las versiones estrictas anteriores fallaban demasiado).
export const CHANNEL_MIN_WIDTH_PERCENT = 0.5;
export const CHANNEL_MAX_WIDTH_PERCENT = 80;
export const CHANNEL_ANGLE_TOLERANCE_DEGREES = 15;
export const CHANNEL_REFERENCE_OUTSIDE_TOLERANCE_PERCENT = 10;

const CHANNEL_LINE_TYPES = new Set(["free_line", "extended_trendline", "dotted_line"]);

export interface ChannelDetectionOptions {
  /** ESTRICTO: solo lineas con sourceTimeframe === timeframe (auto por panel). */
  timeframe?: string;
  /** Logs de diagnostico; default: VITE_CHANNEL_RR_DEBUG === "true". */
  debug?: boolean;
}

export interface DetectedChannel {
  /** Temporalidad de origen de las lineas del canal. */
  timeframe: string;
  upper: ChannelLine & { sourceTimeframe: string };
  lower: ChannelLine & { sourceTimeframe: string };
  result: ChannelRiskRewardResult;
  /** 0..1: calidad del canal (angulo, referencia dentro, cobertura...). */
  confidence: number;
  /** false si la referencia quedo fuera del canal (pero dentro de tolerancia). */
  referenceInside: boolean;
  /** Aviso legible cuando el canal es valido pero con matices. */
  note: string | null;
}

type CandidateLine = ChannelLine & { sourceTimeframe: string };

function debugEnabledByEnv(): boolean {
  try {
    return (import.meta.env?.VITE_CHANNEL_RR_DEBUG as string | undefined) === "true";
  } catch {
    return false;
  }
}

function toLine(d: Drawing): CandidateLine | null {
  if (!CHANNEL_LINE_TYPES.has(d.type)) return null;
  // Requisitos: visible, no bloqueado, dos puntos validos y no identicos.
  if (d.visible === false || d.locked === true) return null;
  const [a, b] = d.points;
  if (!a || !b) return null;
  if (!Number.isFinite(a.time) || !Number.isFinite(b.time)) return null;
  if (!Number.isFinite(a.price) || !Number.isFinite(b.price)) return null;
  if (a.time === b.time) return null; // vertical o puntos identicos: degenerada
  // Normaliza para que time1 < time2 (algunos dibujos van de derecha a izq).
  const [p1, p2] = a.time < b.time ? [a, b] : [b, a];
  return {
    drawingId: d.id,
    time1: p1.time,
    price1: p1.price,
    time2: p2.time,
    price2: p2.price,
    sourceTimeframe: d.sourceTimeframe,
  };
}

/**
 * Diferencia de angulo (grados) entre dos lineas en coordenadas NORMALIZADAS:
 * el tiempo se escala por el rango temporal conjunto y el precio por el rango
 * de precios conjunto (aprox. lo que se ve en pantalla). Comparar pendientes
 * crudas en ms no funciona: los valores son minusculos y la tolerancia
 * porcentual rechazaba canales obvios.
 */
export function pairAngleDifferenceDegrees(
  a: ChannelLine,
  b: ChannelLine,
  referencePrice: number
): number {
  const times = [a.time1, a.time2, b.time1, b.time2];
  const prices = [a.price1, a.price2, b.price1, b.price2];
  const timeSpan = Math.max(...times) - Math.min(...times);
  const priceRange = Math.max(
    Math.max(...prices) - Math.min(...prices),
    Math.abs(referencePrice) * 0.001,
    1e-9
  );
  if (timeSpan <= 0) return 180;
  const angle = (l: ChannelLine) => {
    const dt = (l.time2 - l.time1) / timeSpan;
    const dp = (l.price2 - l.price1) / priceRange;
    return (Math.atan2(dp, dt) * 180) / Math.PI;
  };
  return Math.abs(angle(a) - angle(b));
}

/** true si las dos lineas son ~paralelas (diferencia de angulo <= tolerancia). */
export function linesAreParallel(
  a: ChannelLine,
  b: ChannelLine,
  referencePrice: number
): boolean {
  return pairAngleDifferenceDegrees(a, b, referencePrice) <= CHANNEL_ANGLE_TOLERANCE_DEGREES;
}

/** Fraccion de solape temporal respecto a la linea mas corta (solo SCORE). */
function overlapRatio(a: ChannelLine, b: ChannelLine): number {
  const overlap = Math.min(a.time2, b.time2) - Math.max(a.time1, b.time1);
  const shortest = Math.min(a.time2 - a.time1, b.time2 - b.time1);
  if (shortest <= 0) return 0;
  return Math.max(overlap, 0) / shortest;
}

/**
 * Detecta el mejor canal (y alternativas) entre las lineas del simbolo.
 * Con `options.timeframe`, el filtrado es ESTRICTO por temporalidad de origen
 * (asi cada panel calcula su propio R/R sin contaminarse de otros presets).
 */
export function detectChannels(
  drawings: Drawing[],
  referencePrice: number,
  targetTimeMs: number,
  options?: ChannelDetectionOptions
): { best: DetectedChannel | null; alternates: DetectedChannel[] } {
  const debug = options?.debug ?? debugEnabledByEnv();
  const log = (...args: unknown[]) => {
    if (debug) console.debug("[ChannelRR]", ...args);
  };

  let lines = drawings
    .map(toLine)
    .filter((l): l is CandidateLine => l !== null);
  if (options?.timeframe) {
    lines = lines.filter((l) => l.sourceTimeframe === options.timeframe);
  }
  log("preset:", options?.timeframe ?? "(todas)", "lineas elegibles:", lines.length,
    "refPrice:", referencePrice, "targetTimeMs:", targetTimeMs);

  const candidates: DetectedChannel[] = [];
  let pairs = 0;
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      pairs++;
      const a = lines[i];
      const b = lines[j];
      const pairId = `${a.drawingId}+${b.drawingId}`;

      const angleDiff = pairAngleDifferenceDegrees(a, b, referencePrice);
      if (angleDiff > CHANNEL_ANGLE_TOLERANCE_DEGREES) {
        log("rechazado", pairId, `angulo ${angleDiff.toFixed(1)}° > ${CHANNEL_ANGLE_TOLERANCE_DEGREES}°`);
        continue;
      }

      // Ambas lineas EXTRAPOLADAS al tiempo de referencia (no se exige solape).
      const priceA = getLinePriceAtTime(a, targetTimeMs);
      const priceB = getLinePriceAtTime(b, targetTimeMs);
      const upper = priceA >= priceB ? a : b;
      const lower = priceA >= priceB ? b : a;
      const upperPrice = Math.max(priceA, priceB);
      const lowerPrice = Math.min(priceA, priceB);

      // Ancho razonable (ni lineas pegadas ni sin relacion alguna).
      const widthPercent = ((upperPrice - lowerPrice) / referencePrice) * 100;
      if (widthPercent < CHANNEL_MIN_WIDTH_PERCENT || widthPercent > CHANNEL_MAX_WIDTH_PERCENT) {
        log("rechazado", pairId, `ancho ${widthPercent.toFixed(2)}% fuera de [${CHANNEL_MIN_WIDTH_PERCENT}, ${CHANNEL_MAX_WIDTH_PERCENT}]`);
        continue;
      }

      // Referencia dentro del canal o apenas fuera (tolerancia laxa): un
      // precio que rompe ligeramente el canal sigue dando un R/R util.
      const tol = (CHANNEL_REFERENCE_OUTSIDE_TOLERANCE_PERCENT / 100) * referencePrice;
      const strictlyInside = referencePrice > lowerPrice && referencePrice < upperPrice;
      const nearChannel =
        referencePrice >= lowerPrice - tol && referencePrice <= upperPrice + tol;
      if (!nearChannel) {
        log("rechazado", pairId,
          `referencia ${referencePrice} muy fuera del canal [${lowerPrice.toFixed(2)}, ${upperPrice.toFixed(2)}]`);
        continue;
      }

      const result = computeChannelRiskReward(
        upper, lower, referencePrice, targetTimeMs, "current_price"
      );

      // Score: angulo + referencia dentro + solape + cobertura del targetTime.
      const overlap = overlapRatio(a, b);
      const unionStart = Math.min(a.time1, b.time1);
      const unionEnd = Math.max(a.time2, b.time2);
      const unionSpan = Math.max(unionEnd - unionStart, 1);
      const coversTarget =
        targetTimeMs >= unionStart - unionSpan * 0.25 &&
        targetTimeMs <= unionEnd + unionSpan * 0.25;

      let confidence = 0.35;
      confidence += 0.25 * (1 - angleDiff / CHANNEL_ANGLE_TOLERANCE_DEGREES);
      confidence += strictlyInside ? 0.2 : 0.05;
      confidence += 0.1 * Math.min(overlap, 1);
      if (coversTarget) confidence += 0.1;
      confidence = Math.min(confidence, 1);

      candidates.push({
        timeframe: upper.sourceTimeframe,
        upper,
        lower,
        result,
        confidence,
        referenceInside: strictlyInside,
        note: strictlyInside
          ? null
          : "La referencia está ligeramente fuera del canal detectado.",
      });
      log("candidato", pairId,
        `angulo ${angleDiff.toFixed(1)}°, ancho ${widthPercent.toFixed(2)}%,`,
        `canal [${lowerPrice.toFixed(2)}, ${upperPrice.toFixed(2)}], conf ${confidence.toFixed(2)}`);
    }
  }

  candidates.sort((x, y) => y.confidence - x.confidence);
  log("pares evaluados:", pairs, "candidatos validos:", candidates.length,
    "mejor:", candidates[0]
      ? `${candidates[0].upper.drawingId}+${candidates[0].lower.drawingId} (conf ${candidates[0].confidence.toFixed(2)})`
      : "ninguno");
  return { best: candidates[0] ?? null, alternates: candidates.slice(1, 4) };
}
