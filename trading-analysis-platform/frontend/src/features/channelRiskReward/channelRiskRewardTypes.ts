// Tipos del analisis HIPOTETICO de riesgo/beneficio por canal (Free Lines).

export type ChannelReferenceType = "current_price" | "simulated_entry";

export interface ChannelLine {
  /** id del dibujo free_line origen. */
  drawingId: string;
  time1: number; // ms
  price1: number;
  time2: number; // ms
  price2: number;
}

export interface ChannelRiskRewardResult {
  referenceType: ChannelReferenceType;
  referencePrice: number;
  targetTimeMs: number;
  upperChannelPrice: number;
  lowerChannelPrice: number;
  potentialRewardPercent: number | null;
  potentialRiskPercent: number | null;
  ratio: number | null;
  /** Motivo cuando no se puede calcular (reward<=0 o risk<=0). */
  invalidReason: string | null;
}
