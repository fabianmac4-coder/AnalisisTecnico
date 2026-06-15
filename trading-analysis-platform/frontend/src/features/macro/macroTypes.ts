// Tipos del Macro Dashboard (forma de /api/macro/overview).
// Informativo: no es señal de compra/venta. Datos parciales si faltan proveedores.

export type MacroStatus = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MISSING";
export type MacroTrend = "IMPROVING" | "WORSENING" | "STABLE" | "UNKNOWN";
export type MacroRiskLevel = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
export type YieldCurveStatus = "NORMAL" | "FLAT" | "INVERTED" | "UNKNOWN";

export interface MacroIndicator {
  key: string;
  label: string;
  value: number | null;
  displayValue: string;
  previousValue?: number | null;
  change?: number | null;
  trend: MacroTrend;
  status: MacroStatus;
  source: string;
  lastUpdated?: string | null;
  explanation?: string | null;
  /** Clave para el texto de ayuda del tooltip (por defecto = key). */
  helpKey?: string;
  // Extra para instrumentos de mercado (FX/commodities/crypto).
  symbol?: string;
  changePercent?: number | null;
}

export interface EconomicCalendarEvent {
  eventName: string;
  date: string | null;
  time?: string | null;
  country?: string | null;
  impact: "HIGH" | "MEDIUM" | "LOW";
  consensus?: string | null;
  previous?: string | null;
  source: string;
  notes?: string | null;
}

export interface MacroRisk {
  riskLevel: MacroRiskLevel;
  score: number | null;
  drivers: string[];
  risks: string[];
}

export interface MacroExecutiveSummary {
  riskLevel: MacroRiskLevel;
  riskLabel: string;
  summary: string;
  lastUpdated: string | null;
}

export interface MacroRates {
  treasury2Y?: MacroIndicator;
  treasury5Y?: MacroIndicator;
  treasury10Y?: MacroIndicator;
  treasury30Y?: MacroIndicator;
  yieldCurve10Y2Y?: MacroIndicator;
  curveStatus: YieldCurveStatus;
  [key: string]: MacroIndicator | YieldCurveStatus | undefined;
}

export interface MacroOverviewResponse {
  executiveSummary: MacroExecutiveSummary;
  macroRisk: MacroRisk;
  usaIndicators: Record<string, MacroIndicator>;
  rates: MacroRates;
  globalMarkets: {
    fx: MacroIndicator[];
    commodities: MacroIndicator[];
    crypto: MacroIndicator[];
  };
  economicCalendar: EconomicCalendarEvent[];
  economicCalendarAvailable?: boolean;
  economicCalendarSource?: "FRED" | "CONFIGURED_PROVIDER" | "UNAVAILABLE";
  whatThisMeans: string[];
  dataAvailability: Record<string, boolean>;
  warnings: string[];
  lastUpdated: string | null;
  fromCache?: boolean;
}

export const RISK_COLOR: Record<MacroRiskLevel, string> = {
  GREEN: "#22c55e",
  YELLOW: "#f59e0b",
  RED: "#ef4444",
  UNKNOWN: "#6b7280",
};

export const RISK_LABEL_ES: Record<MacroRiskLevel, string> = {
  GREEN: "Riesgo bajo",
  YELLOW: "Riesgo moderado",
  RED: "Riesgo elevado",
  UNKNOWN: "Sin datos",
};

export const CURVE_LABEL_ES: Record<YieldCurveStatus, string> = {
  NORMAL: "Normal",
  FLAT: "Plana",
  INVERTED: "Invertida",
  UNKNOWN: "Sin datos",
};

export const STATUS_TEXT_COLOR: Record<MacroStatus, string> = {
  POSITIVE: "text-up",
  NEUTRAL: "text-muted",
  NEGATIVE: "text-down",
  MISSING: "text-muted",
};
