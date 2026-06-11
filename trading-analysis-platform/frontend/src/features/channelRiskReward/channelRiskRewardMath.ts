// Matematica PURA del riesgo/beneficio por canal (sin UI, sin red).
// Los tiempos de los dibujos estan en MILISEGUNDOS Unix (igual que en SQL):
// jamas mezclar con los segundos de Lightweight Charts.

import type {
  ChannelLine,
  ChannelReferenceType,
  ChannelRiskRewardResult,
} from "./channelRiskRewardTypes";

/**
 * Precio de una linea (2 puntos) en un tiempo dado, por interpolacion lineal
 * (o EXTRAPOLACION si el tiempo cae fuera del segmento).
 */
export function getLinePriceAtTime(line: ChannelLine, targetTimeMs: number): number {
  if (line.time2 === line.time1) return line.price1; // linea vertical: degenerada
  const slope = (line.price2 - line.price1) / (line.time2 - line.time1);
  return line.price1 + slope * (targetTimeMs - line.time1);
}

/**
 * R/R hipotetico para LONG dentro de un canal en `targetTimeMs`:
 *   reward = canalSuperior - referencia ; risk = referencia - canalInferior.
 * Si superior < inferior en ese tiempo, se intercambian automaticamente.
 */
export function computeChannelRiskReward(
  upper: ChannelLine,
  lower: ChannelLine,
  referencePrice: number,
  targetTimeMs: number,
  referenceType: ChannelReferenceType
): ChannelRiskRewardResult {
  let upperPrice = getLinePriceAtTime(upper, targetTimeMs);
  let lowerPrice = getLinePriceAtTime(lower, targetTimeMs);
  if (lowerPrice > upperPrice) {
    [upperPrice, lowerPrice] = [lowerPrice, upperPrice]; // swap automatico
  }

  const reward = upperPrice - referencePrice;
  const risk = referencePrice - lowerPrice;

  const base: ChannelRiskRewardResult = {
    referenceType,
    referencePrice,
    targetTimeMs,
    upperChannelPrice: round4(upperPrice),
    lowerChannelPrice: round4(lowerPrice),
    potentialRewardPercent: null,
    potentialRiskPercent: null,
    ratio: null,
    invalidReason: null,
  };

  if (referencePrice <= 0) {
    return { ...base, invalidReason: "Precio de referencia inválido" };
  }
  if (reward <= 0) {
    return {
      ...base,
      potentialRiskPercent: round2((risk / referencePrice) * 100),
      invalidReason:
        "Sin recorrido al canal superior desde esta referencia (reward ≤ 0)",
    };
  }
  if (risk <= 0) {
    return {
      ...base,
      potentialRewardPercent: round2((reward / referencePrice) * 100),
      invalidReason:
        "La referencia está en o bajo el canal inferior; el riesgo no es calculable",
    };
  }

  return {
    ...base,
    potentialRewardPercent: round2((reward / referencePrice) * 100),
    potentialRiskPercent: round2((risk / referencePrice) * 100),
    ratio: round2(reward / risk),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
