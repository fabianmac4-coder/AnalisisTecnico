// Cálculos de las cajas Long/Short Position (riesgo/recompensa). Función PURA,
// nunca lanza: geometría inválida devuelve isValid=false + mensaje, no crash.
import type { PositionBoxMetrics, PositionBoxType } from "./drawingTypes";

export interface PositionBoxInput {
  type: PositionBoxType;
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
  quantity: number;
  fees?: number;
}

function round(v: number, n = 2): number {
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** n;
  return Math.round(v * f) / f;
}

export function calcPositionBox(input: PositionBoxInput): PositionBoxMetrics {
  const { type, entryPrice, targetPrice, stopPrice } = input;
  const quantity = input.quantity;
  const fees = input.fees ?? 0;
  const isLong = type === "LONG_POSITION";

  // Riesgo/recompensa por acción según el tipo.
  const riskPerShare = isLong ? entryPrice - stopPrice : stopPrice - entryPrice;
  const rewardPerShare = isLong ? targetPrice - entryPrice : entryPrice - targetPrice;

  // Validación de geometría (no lanza; solo marca isValid + mensaje).
  let validationMessage: string | undefined;
  if (!(entryPrice > 0 && targetPrice > 0 && stopPrice > 0)) {
    validationMessage = "Los precios deben ser mayores que 0.";
  } else if (!(quantity > 0)) {
    validationMessage = "La cantidad debe ser mayor que 0.";
  } else if (isLong && !(targetPrice > entryPrice && entryPrice > stopPrice)) {
    validationMessage = "En LONG: objetivo > entrada > stop.";
  } else if (!isLong && !(stopPrice > entryPrice && entryPrice > targetPrice)) {
    validationMessage = "En SHORT: stop > entrada > objetivo.";
  } else if (riskPerShare <= 0) {
    validationMessage = "El riesgo por acción debe ser positivo.";
  } else if (rewardPerShare <= 0) {
    validationMessage = "La recompensa por acción debe ser positiva.";
  }
  const isValid = validationMessage === undefined;

  // Las fees suman al riesgo y restan a la recompensa (modelo simple Fase 1).
  const riskAmount = riskPerShare * quantity + fees;
  const rewardAmount = rewardPerShare * quantity - fees;
  const riskPercent = entryPrice > 0 ? (riskPerShare / entryPrice) * 100 : 0;
  const rewardPercent = entryPrice > 0 ? (rewardPerShare / entryPrice) * 100 : 0;
  const riskRewardRatio = riskPerShare > 0 ? rewardPerShare / riskPerShare : null;
  // Break-even ajustado por fees por acción.
  const feePerShare = quantity > 0 ? fees / quantity : 0;
  const breakEvenPrice = isLong ? entryPrice + feePerShare : entryPrice - feePerShare;

  return {
    riskPerShare: round(riskPerShare, 4),
    rewardPerShare: round(rewardPerShare, 4),
    riskAmount: round(riskAmount),
    rewardAmount: round(rewardAmount),
    riskPercent: round(riskPercent),
    rewardPercent: round(rewardPercent),
    riskRewardRatio: riskRewardRatio === null ? null : round(riskRewardRatio),
    targetPnL: round(rewardAmount),
    stopPnL: round(-riskAmount),
    breakEvenPrice: round(breakEvenPrice, 4),
    isValid,
    validationMessage,
  };
}

/** Defaults TradingView-style al crear la caja desde un click (entry). */
export function defaultPositionPrices(
  type: PositionBoxType,
  entryPrice: number
): { targetPrice: number; stopPrice: number } {
  if (type === "LONG_POSITION") {
    return { targetPrice: entryPrice * 1.05, stopPrice: entryPrice * 0.97 };
  }
  return { targetPrice: entryPrice * 0.95, stopPrice: entryPrice * 1.03 };
}
