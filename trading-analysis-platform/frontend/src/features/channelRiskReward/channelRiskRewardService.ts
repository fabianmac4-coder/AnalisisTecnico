// Helpers del R/R de canal: conversion de dibujos y resumen en texto.

import type { Drawing } from "@/features/drawings/drawingTypes";
import type { ChannelLine, ChannelRiskRewardResult } from "./channelRiskRewardTypes";

/** Convierte un dibujo free_line (2 puntos) a ChannelLine; null si no aplica. */
export function drawingToChannelLine(drawing: Drawing): ChannelLine | null {
  if (drawing.type !== "free_line") return null;
  const [a, b] = drawing.points;
  if (!a || !b) return null;
  return {
    drawingId: drawing.id,
    time1: a.time,
    price1: a.price,
    time2: b.time,
    price2: b.price,
  };
}

/** Resumen legible (para copiar o enviar a la IA). */
export function channelSummaryText(result: ChannelRiskRewardResult): string {
  const lines = [
    "Riesgo/beneficio de canal (hipotético):",
    `- Referencia: ${result.referenceType === "simulated_entry" ? "entrada simulada" : "precio actual"} @ ${result.referencePrice.toFixed(2)}`,
    `- Canal superior: ${result.upperChannelPrice.toFixed(2)}`,
    `- Canal inferior: ${result.lowerChannelPrice.toFixed(2)}`,
  ];
  if (result.invalidReason) {
    lines.push(`- No calculable: ${result.invalidReason}`);
  } else {
    lines.push(`- Beneficio potencial: +${result.potentialRewardPercent?.toFixed(2)}%`);
    lines.push(`- Riesgo potencial: -${result.potentialRiskPercent?.toFixed(2)}%`);
    lines.push(`- Ratio R/R: ${result.ratio?.toFixed(2)} : 1`);
  }
  return lines.join("\n");
}

/** Forma compacta para inyectar al contexto de la IA. */
export function channelResultForAi(
  result: ChannelRiskRewardResult,
  confidence?: number | null,
  chartTimeframe?: string | null
): Record<string, unknown> {
  return {
    referenceType: result.referenceType,
    entryPrice: result.referencePrice,
    upperChannelPrice: result.upperChannelPrice,
    lowerChannelPrice: result.lowerChannelPrice,
    potentialRewardPercent: result.potentialRewardPercent,
    potentialRiskPercent: result.potentialRiskPercent,
    ratio: result.ratio,
    invalidReason: result.invalidReason,
    // Presentes solo cuando el canal fue AUTO-detectado (la deteccion es por
    // temporalidad: este es el canal de la grafica activa, no una mezcla).
    chartTimeframe: chartTimeframe ?? undefined,
    confidence: confidence ?? undefined,
    autoDetected: confidence != null,
  };
}
