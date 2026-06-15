// Tipos de Inteligencia de Mercado (forma de /api/market-intelligence/overview).
// Proxy de sentimiento (NO el índice oficial de CNN); no es señal de compra/venta.

export interface SparklinePoint {
  time: number;
  value: number;
}

export interface MarketIndexDto {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  trend: "UP" | "DOWN" | "FLAT";
  sparkline: SparklinePoint[];
  lastUpdated: string | null;
}

export type SentimentLabel =
  | "EXTREME_FEAR"
  | "FEAR"
  | "NEUTRAL"
  | "GREED"
  | "EXTREME_GREED"
  | "UNAVAILABLE";

export interface SentimentComponentDto {
  name: string;
  score: number;
  status: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  value: number | null;
  source: string;
  weight: number;
  explanation: string;
}

export interface SentimentDto {
  score: number | null;
  label: SentimentLabel;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  source: string;
  components: SentimentComponentDto[];
  warnings: string[];
  fromCache?: boolean;
}

export interface FearGreedDto {
  enabled: boolean;
  value: number | null;
  label: SentimentLabel;
  source: string;
  lastUpdated: string | null;
  components: SentimentComponentDto[];
}

export interface MoverSummaryItem {
  symbol: string;
  name?: string | null;
  price?: number | null;
  change?: number | null;
  changePercent?: number | null;
  volume?: number | null;
}

export interface MarketMoversSummaryDto {
  topGainers: MoverSummaryItem[];
  topLosers: MoverSummaryItem[];
  mostActive: MoverSummaryItem[];
  trending: MoverSummaryItem[];
}

export interface MarketNewsSummaryItem {
  id: number | null;
  title: string | null;
  publisher: string | null;
  provider: string | null;
  category: string | null;
  url: string | null;
  publishedAt: string | null;
  relevanceReason?: string | null;
}

export interface MarketIntelligenceOverview {
  indices: MarketIndexDto[];
  sentiment: SentimentDto;
  fearGreed: FearGreedDto;
  marketMoversSummary: MarketMoversSummaryDto;
  topNews: MarketNewsSummaryItem[];
  whatThisMeans: string[];
  lastUpdated: string | null;
  fromCache?: boolean;
  warnings: string[];
}

/** Etiquetas en español del sentimiento (display). */
export const SENTIMENT_LABEL_ES: Record<SentimentLabel, string> = {
  EXTREME_FEAR: "Miedo extremo",
  FEAR: "Miedo",
  NEUTRAL: "Neutral",
  GREED: "Codicia",
  EXTREME_GREED: "Codicia extrema",
  UNAVAILABLE: "Sin datos",
};

/** Color del gauge por etiqueta. */
export const SENTIMENT_COLOR: Record<SentimentLabel, string> = {
  EXTREME_FEAR: "#ef4444",
  FEAR: "#f59e0b",
  NEUTRAL: "#9ca3af",
  GREED: "#22c55e",
  EXTREME_GREED: "#16a34a",
  UNAVAILABLE: "#6b7280",
};
