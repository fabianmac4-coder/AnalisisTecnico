// Tipos del Executive Stock Scorecard (Fase 1). Espejo de la respuesta del
// backend GET /api/stocks/{symbol}/scorecard. NO es asesoría financiera.

export type StockOverallView =
  | "ATTRACTIVE_NOW"
  | "INTERESTING_BUT_WAIT_FOR_PULLBACK"
  | "FUNDAMENTALLY_GOOD_BUT_TECHNICALLY_EXTENDED"
  | "TECHNICALLY_STRONG_BUT_FUNDAMENTALS_MIXED"
  | "MIXED_REQUIRES_CONFIRMATION"
  | "RISKY_AVOID_FOR_NOW"
  | "INSUFFICIENT_DATA";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | "UNKNOWN";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type MetricStatus = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MISSING";

/** Una métrica del breakdown: el dato real y cuánto aportó al puntaje. */
export interface ScoreMetric {
  key: string;
  label: string;
  value: number | string | null;
  displayValue: string;
  source: string;
  status: MetricStatus;
  scoreContribution: number;
  maxContribution: number;
  explanation: string;
}

export interface ScoreBreakdownSection {
  score: number | null;
  metrics: ScoreMetric[];
}

export interface ScorecardBreakdown {
  technical: ScoreBreakdownSection;
  fundamentals: ScoreBreakdownSection;
  news: ScoreBreakdownSection;
  sentiment: ScoreBreakdownSection;
}

export interface ScoringConfigRef {
  c081Id: number;
  name: string;
  version: number;
}

export interface StockScorecardResponse {
  symbol: string;
  companyName?: string | null;
  technicalScore: number | null;
  fundamentalScore: number | null;
  newsScore: number | null;
  sentimentScore: number | null;
  overallScore: number | null;
  riskLevel: RiskLevel;
  confidenceLevel: ConfidenceLevel;
  overallView: StockOverallView;
  summary: string;
  strengths: string[];
  risks: string[];
  watchItems: string[];
  dataAvailability: {
    technical: boolean;
    fundamentals: boolean;
    news: boolean;
    sentiment: boolean;
  };
  lastUpdated: string;
  warnings: string[];
  /** Desglose por métrica (valor real, fuente, contribución). */
  breakdown?: ScorecardBreakdown;
  /** Config de puntuación (C081) usada. */
  scoringConfig?: ScoringConfigRef;
}

export const METRIC_STATUS_LABEL: Record<MetricStatus, string> = {
  POSITIVE: "Positivo",
  NEUTRAL: "Neutral",
  NEGATIVE: "Negativo",
  MISSING: "Sin dato",
};

export const METRIC_STATUS_TONE: Record<MetricStatus, "good" | "warn" | "bad" | "neutral"> = {
  POSITIVE: "good",
  NEUTRAL: "warn",
  NEGATIVE: "bad",
  MISSING: "neutral",
};

/** Etiquetas legibles (ES) de la vista general. */
export const OVERALL_VIEW_LABEL: Record<StockOverallView, string> = {
  ATTRACTIVE_NOW: "Atractiva ahora",
  INTERESTING_BUT_WAIT_FOR_PULLBACK: "Interesante · esperar pullback",
  FUNDAMENTALLY_GOOD_BUT_TECHNICALLY_EXTENDED:
    "Buenos fundamentales · técnicamente extendida",
  TECHNICALLY_STRONG_BUT_FUNDAMENTALS_MIXED:
    "Técnicamente fuerte · fundamentales mixtos",
  MIXED_REQUIRES_CONFIRMATION: "Mixta · requiere confirmación",
  RISKY_AVOID_FOR_NOW: "Riesgosa por ahora",
  INSUFFICIENT_DATA: "Datos insuficientes",
};

export type Tone = "good" | "warn" | "bad" | "neutral";

/** Tono (color) de cada vista general. */
export const OVERALL_VIEW_TONE: Record<StockOverallView, Tone> = {
  ATTRACTIVE_NOW: "good",
  INTERESTING_BUT_WAIT_FOR_PULLBACK: "warn",
  FUNDAMENTALLY_GOOD_BUT_TECHNICALLY_EXTENDED: "warn",
  TECHNICALLY_STRONG_BUT_FUNDAMENTALS_MIXED: "warn",
  MIXED_REQUIRES_CONFIRMATION: "warn",
  RISKY_AVOID_FOR_NOW: "bad",
  INSUFFICIENT_DATA: "neutral",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: "Bajo",
  MEDIUM: "Medio",
  HIGH: "Alto",
  VERY_HIGH: "Muy alto",
  UNKNOWN: "Desconocido",
};

export const RISK_TONE: Record<RiskLevel, Tone> = {
  LOW: "good",
  MEDIUM: "warn",
  HIGH: "bad",
  VERY_HIGH: "bad",
  UNKNOWN: "neutral",
};

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

/** Tono por puntaje 0-100 (null = sin datos). */
export function scoreTone(score: number | null): Tone {
  if (score === null) return "neutral";
  if (score >= 65) return "good";
  if (score >= 45) return "warn";
  return "bad";
}

/** Clases Tailwind por tono (texto + fondo suave). */
export const TONE_TEXT: Record<Tone, string> = {
  good: "text-up",
  warn: "text-amber-400",
  bad: "text-down",
  neutral: "text-muted",
};

export const TONE_BADGE: Record<Tone, string> = {
  good: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  warn: "bg-amber-900/40 text-amber-300 border-amber-700",
  bad: "bg-red-900/40 text-red-300 border-red-700",
  neutral: "bg-panel-3 text-muted border-edge",
};

/** Datos clave (valores reales) del breakdown, para enriquecer el contexto. */
export function scorecardKeyMetricsLines(sc: StockScorecardResponse): string[] {
  if (!sc.breakdown) return [];
  const lines: string[] = [];
  const sections: Array<[string, ScoreBreakdownSection | undefined]> = [
    ["Técnico", sc.breakdown.technical],
    ["Fundamental", sc.breakdown.fundamentals],
  ];
  for (const [label, section] of sections) {
    if (!section) continue;
    const items = section.metrics
      .filter((m) => m.status !== "MISSING" && m.maxContribution > 0)
      .map((m) => `${m.label}: ${m.displayValue}`);
    if (items.length) lines.push(`- ${label}: ${items.join(", ")}`);
  }
  return lines;
}

/** Mensaje (ES) para pedirle a la IA que explique el scorecard. */
export function buildScorecardExplainMessage(sc: StockScorecardResponse): string {
  const n = (v: number | null) => (v === null ? "n/d" : String(v));
  const keyMetrics = scorecardKeyMetricsLines(sc);
  return [
    `Explícame este Stock Scorecard de ${sc.symbol} en lenguaje simple. Dame el ` +
      `escenario alcista, bajista, riesgos, niveles a vigilar y si parece mejor ` +
      `entrar ahora o esperar confirmación. No lo presentes como consejo ` +
      `financiero garantizado.`,
    "",
    "Resumen del scorecard:",
    `- Vista general: ${OVERALL_VIEW_LABEL[sc.overallView]}`,
    `- Puntaje general: ${n(sc.overallScore)}`,
    `- Técnico: ${n(sc.technicalScore)} · Fundamental: ${n(sc.fundamentalScore)} · ` +
      `Noticias: ${n(sc.newsScore)} · Sentimiento: ${n(sc.sentimentScore)}`,
    `- Riesgo: ${RISK_LABEL[sc.riskLevel]} · Confianza: ${CONFIDENCE_LABEL[sc.confidenceLevel]}`,
    sc.strengths.length ? `- Fortalezas: ${sc.strengths.join("; ")}` : "",
    sc.risks.length ? `- Riesgos: ${sc.risks.join("; ")}` : "",
    sc.watchItems.length ? `- A vigilar: ${sc.watchItems.join("; ")}` : "",
    ...(keyMetrics.length ? ["", "Datos clave (valores reales):", ...keyMetrics] : []),
    `Resumen: ${sc.summary}`,
  ]
    .filter(Boolean)
    .join("\n");
}
