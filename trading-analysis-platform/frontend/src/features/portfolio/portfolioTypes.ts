// Tipos de Portfolio Analysis (Fase 4). Informativo; no es asesoría financiera.

export interface Portfolio {
  c090Id: number;
  name: string;
  description?: string | null;
  baseCurrency: string;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioPosition {
  c091Id: number;
  c090Id: number;
  c010Id?: number | null;
  ticker: string;
  yahooSymbol?: string | null;
  companyName?: string | null;
  assetType: string;
  quantity: number;
  averageCost: number;
  purchaseDate?: string | null;
  currency?: string | null;
  sector?: string | null;
  industry?: string | null;
  notes?: string | null;
}

export interface AnalysisPosition {
  c091Id: number;
  ticker: string;
  companyName?: string | null;
  quantity: number;
  averageCost: number;
  currentPrice: number | null;
  costBasis: number | null;
  currentValue: number | null;
  gainLoss: number | null;
  gainLossPercent: number | null;
  portfolioWeight: number | null;
  sector?: string | null;
  industry?: string | null;
  assetType?: string | null;
  currency?: string | null;
  dataWarnings: string[];
}

export interface AllocationSlice {
  label: string;
  value: number | null;
  weight: number | null;
}

export interface PortfolioRecommendation {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
}

export interface PortfolioBenchmark {
  available: boolean;
  benchmarkSymbol: string;
  benchmarkName: string;
  portfolioReturn?: number | null;
  benchmarkReturn?: number | null;
  alphaEstimate?: number | null;
  period?: string;
  note?: string;
  message?: string;
}

export type RiskLevel =
  | "CONSERVATIVE"
  | "MODERATE"
  | "AGGRESSIVE"
  | "HIGH_CONCENTRATION"
  | "UNKNOWN";

export interface PortfolioRisk {
  concentrationRisk: {
    largestPositionTicker: string | null;
    largestPositionWeight: number | null;
    top3Weight: number | null;
    flagged: boolean;
  };
  sectorRisk: {
    largestSector: string | null;
    largestSectorWeight: number | null;
    flagged: boolean;
  };
  estimatedVolatility: number | null;
  estimatedBeta: number | null;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  correlationWarnings: string[];
  advancedMetricsAvailable: boolean;
  advancedMetricsNote: string;
  riskLevel: RiskLevel;
}

export interface PortfolioAnalysis {
  portfolio: { c090Id: number; name: string; baseCurrency: string; lastUpdated: string };
  summary: {
    totalCost: number | null;
    currentValue: number | null;
    totalGainLoss: number | null;
    totalGainLossPercent: number | null;
    positionCount: number;
    bestPosition: AnalysisPosition | null;
    worstPosition: AnalysisPosition | null;
    cashValue: number | null;
  };
  positions: AnalysisPosition[];
  allocation: {
    byPosition: AllocationSlice[];
    bySector: AllocationSlice[];
    byIndustry: AllocationSlice[];
    byAssetType: AllocationSlice[];
    byCurrency: AllocationSlice[];
  };
  risk: PortfolioRisk;
  benchmark: PortfolioBenchmark;
  recommendations: PortfolioRecommendation[];
  aiSummary: string | null;
  warnings: string[];
}

export interface PortfolioCreate {
  name: string;
  description?: string | null;
  baseCurrency?: string;
}

export interface PositionCreate {
  ticker: string;
  quantity: number;
  averageCost: number;
  purchaseDate?: string | null;
  notes?: string | null;
  assetType?: string | null;
  sector?: string | null;
  industry?: string | null;
}

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  CONSERVATIVE: "Conservador",
  MODERATE: "Moderado",
  AGGRESSIVE: "Agresivo",
  HIGH_CONCENTRATION: "Alta concentración",
  UNKNOWN: "Sin datos",
};

export const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  CONSERVATIVE: "#22c55e",
  MODERATE: "#f59e0b",
  AGGRESSIVE: "#f97316",
  HIGH_CONCENTRATION: "#ef4444",
  UNKNOWN: "#6b7280",
};

export const SEVERITY_COLOR: Record<string, string> = {
  LOW: "text-muted",
  MEDIUM: "text-yellow-400",
  HIGH: "text-down",
};
