// Auto-deteccion de canales a partir de las lineas dibujadas por el usuario
// (free_line / extended_trendline). Matematica PURA: tiempos en MILISEGUNDOS.
//
// Un par de lineas es un canal si: pendientes similares, rangos de tiempo con
// solape, ancho razonable y precio de referencia dentro (o casi) del canal.

import type { Drawing } from "@/features/drawings/drawingTypes";
import { computeChannelRiskReward, getLinePriceAtTime } from "./channelRiskRewardMath";
import type { ChannelLine, ChannelRiskRewardResult } from "./channelRiskRewardTypes";

// Tolerancias practicas (espejo de las constantes del spec).
export const CHANNEL_SLOPE_TOLERANCE_PERCENT = 15;
export const CHANNEL_MIN_WIDTH_PERCENT = 1;
export const CHANNEL_MAX_WIDTH_PERCENT = 40;
export const CHANNEL_REFERENCE_OUTSIDE_TOLERANCE_PERCENT = 5;
const MIN_OVERLAP_RATIO = 0.2;

const CHANNEL_LINE_TYPES = new Set(["free_line", "extended_trendline", "dotted_line"]);

export interface DetectedChannel {
  upper: ChannelLine & { sourceTimeframe: string };
  lower: ChannelLine & { sourceTimeframe: string };
  result: ChannelRiskRewardResult;
  /** 0..1: calidad del canal (pendiente, solape, referencia dentro...). */
  confidence: number;
}

function toLine(d: Drawing): (ChannelLine & { sourceTimeframe: string }) | null {
  if (!CHANNEL_LINE_TYPES.has(d.type) || d.visible === false) return null;
  const [a, b] = d.points;
  if (!a || !b || a.time === b.time) return null;
  return {
    drawingId: d.id,
    time1: a.time,
    price1: a.price,
    time2: b.time,
    price2: b.price,
    sourceTimeframe: d.sourceTimeframe,
  };
}

function slopeOf(line: ChannelLine): number {
  return (line.price2 - line.price1) / (line.time2 - line.time1);
}

/** Pendientes "paralelas" si difieren menos del % de tolerancia (normalizado
 * por la magnitud mayor; dos lineas casi planas tambien cuentan). */
export function slopesAreParallel(a: number, b: number, avgPrice: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale === 0) return true; // ambas horizontales
  // Normaliza por precio para que la tolerancia sea relativa al instrumento.
  const diffPerDay = Math.abs(a - b) * 86_400_000;
  const refPerDay = scale * 86_400_000;
  const relative = diffPerDay / Math.max(refPerDay, avgPrice * 0.0001);
  return relative <= CHANNEL_SLOPE_TOLERANCE_PERCENT / 100;
}

function overlapRatio(a: ChannelLine, b: ChannelLine): number {
  const aStart = Math.min(a.time1, a.time2);
  const aEnd = Math.max(a.time1, a.time2);
  const bStart = Math.min(b.time1, b.time2);
  const bEnd = Math.max(b.time1, b.time2);
  const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
  const shortest = Math.min(aEnd - aStart, bEnd - bStart);
  if (shortest <= 0) return 0;
  return Math.max(overlap, 0) / shortest;
}

/**
 * Detecta el mejor canal (y alternativas) entre las lineas del simbolo.
 * `preferTimeframe` da prioridad a canales dibujados en esa temporalidad.
 */
export function detectChannels(
  drawings: Drawing[],
  referencePrice: number,
  targetTimeMs: number,
  preferTimeframe?: string
): { best: DetectedChannel | null; alternates: DetectedChannel[] } {
  const lines = drawings
    .map(toLine)
    .filter((l): l is ChannelLine & { sourceTimeframe: string } => l !== null);

  const candidates: DetectedChannel[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];

      if (!slopesAreParallel(slopeOf(a), slopeOf(b), referencePrice)) continue;
      const overlap = overlapRatio(a, b);
      if (overlap < MIN_OVERLAP_RATIO) continue;

      const priceA = getLinePriceAtTime(a, targetTimeMs);
      const priceB = getLinePriceAtTime(b, targetTimeMs);
      const upper = priceA >= priceB ? a : b;
      const lower = priceA >= priceB ? b : a;
      const upperPrice = Math.max(priceA, priceB);
      const lowerPrice = Math.min(priceA, priceB);

      // Ancho razonable (ni lineas pegadas ni sin relacion).
      const widthPercent = ((upperPrice - lowerPrice) / referencePrice) * 100;
      if (widthPercent < CHANNEL_MIN_WIDTH_PERCENT) continue;
      if (widthPercent > CHANNEL_MAX_WIDTH_PERCENT) continue;

      // Referencia dentro del canal (o apenas fuera, con tolerancia).
      const tol = (CHANNEL_REFERENCE_OUTSIDE_TOLERANCE_PERCENT / 100) * referencePrice;
      const inside =
        referencePrice >= lowerPrice - tol && referencePrice <= upperPrice + tol;
      if (!inside) continue;

      const result = computeChannelRiskReward(
        upper, lower, referencePrice, targetTimeMs, "current_price"
      );

      // Score: solape + referencia bien adentro + misma temporalidad.
      let confidence = 0.4 + 0.3 * Math.min(overlap, 1);
      const strictlyInside =
        referencePrice > lowerPrice && referencePrice < upperPrice;
      if (strictlyInside) confidence += 0.2;
      if (preferTimeframe && upper.sourceTimeframe === preferTimeframe) confidence += 0.1;
      candidates.push({ upper, lower, result, confidence: Math.min(confidence, 1) });
    }
  }

  candidates.sort((x, y) => y.confidence - x.confidence);
  return { best: candidates[0] ?? null, alternates: candidates.slice(1, 4) };
}
