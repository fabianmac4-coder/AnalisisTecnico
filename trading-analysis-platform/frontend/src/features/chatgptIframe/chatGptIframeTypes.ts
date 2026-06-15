// Tipos del modo ChatGPT (iframe/helper). Este modo NO usa la API de OpenAI
// ni guarda mensajes en SQL: solo genera prompts con el contexto del ticker.

export type ChatGptPromptType =
  | "general_analysis"
  | "technical_analysis"
  | "news_catalysts"
  | "bullish_bearish"
  | "risk_analysis"
  | "support_resistance"
  | "sector_comparison"
  | "drawings_review"
  | "market_context_analysis"
  | "macro_market_stock_decision"
  | "portfolio_analysis";

export const PROMPT_TYPE_LABELS: Record<ChatGptPromptType, string> = {
  general_analysis: "Análisis general",
  technical_analysis: "Análisis técnico",
  news_catalysts: "Noticias y catalizadores",
  bullish_bearish: "Escenarios alcista/bajista",
  risk_analysis: "Análisis de riesgo",
  support_resistance: "Soportes y resistencias",
  sector_comparison: "Comparación ETF/sector",
  drawings_review: "Revisión de mis dibujos",
  market_context_analysis: "Contexto de mercado + acción",
  macro_market_stock_decision: "Macro + mercado + decisión",
  portfolio_analysis: "Análisis de portafolio",
};

export interface ChatGptContext {
  symbol: string;
  yahooSymbol?: string;
  instrument?: {
    name?: string | null;
    exchange?: string | null;
    currency?: string | null;
    sector?: string | null;
    industry?: string | null;
  } | null;
  quote?: {
    price?: number | null;
    change?: number | null;
    changePercent?: number | null;
    currency?: string | null;
    marketState?: string | null;
  } | null;
  dailySummary?: {
    bars?: number;
    lastClose?: number;
    yearHigh?: number;
    yearLow?: number;
    high20d?: number;
    low20d?: number;
    changePercent20d?: number | null;
  } | null;
  /** Fecha de la última vela diaria (corte de los datos). */
  asOf?: string | null;
  indicatorValues?: Record<string, number>;
  /** Contexto semanal (4Y_1W): cierre, RSI14 y SMA 10/40 semanas. */
  weeklySummary?: {
    lastClose?: number;
    lastBarDate?: string | null;
    rsi14w?: number | null;
    sma10w?: number | null;
    sma40w?: number | null;
  } | null;
  indicators?: Array<{
    id: string;
    type: string;
    visible: boolean;
    params: Record<string, unknown>;
  }>;
  /** Valores calculados con los parámetros configurados por el usuario. */
  configuredValues?: Record<
    string,
    number | { line?: number; signal?: number; histogram?: number; upper?: number; middle?: number; lower?: number }
  >;
  drawings?: Array<{
    type: string;
    sourceTimeframe: string;
    points: Array<{ time?: number; date?: string | null; price?: number }>;
    name?: string;
    comment?: string;
  }>;
  watchlist?: {
    favorite?: boolean;
    tags?: string[];
    notes?: string | null;
    lastViewed?: string | null;
  } | null;
  /** Entradas simuladas (paper trading, hipotéticas) del usuario. */
  simulatedEntries?: Array<{
    type: string;
    status: string;
    entryPrice: number;
    entryDate: string;
    quantity?: number | null;
    name?: string | null;
    notes?: string | null;
    currentPrice?: number | null;
    gainLossPercent?: number | null;
    daysSinceEntry?: number;
  }>;
  /** Titulares recientes del ticker (máx. 5, best-effort del backend). */
  recentNews?: Array<{
    title?: string | null;
    publisher?: string | null;
    publishedAt?: string | null;
    url?: string | null;
  }>;
  /** Top 3 titulares globales de mercado (cache SQL del backend). */
  recentGlobalMarketNews?: Array<{
    title?: string | null;
    publisher?: string | null;
    publishedAt?: string | null;
  }>;
  /** Top 3 titulares de acciones en movimiento hoy. */
  topTrendingStocksTodayNews?: Array<{
    title?: string | null;
    publisher?: string | null;
    publishedAt?: string | null;
  }>;
  timeframes?: Array<{ key: string; label: string; interval: string }>;
}

export interface ChatGptContextToggles {
  includePriceSummary: boolean;
  includeIndicators: boolean;
  includeDrawings: boolean;
  includeWatchlistNotes: boolean;
  includeFavoriteStatus: boolean;
  includeTimeframeSummary: boolean;
  /** Opcional para retrocompatibilidad de pruebas; el store lo fija en true. */
  includeScorecard?: boolean;
  /** Incluir las métricas DETALLADAS del scorecard (valores reales). */
  includeScorecardMetrics?: boolean;
  /** Incluir el contexto de Inteligencia de Mercado (sentimiento + índices). */
  includeMarketIntelligence?: boolean;
  /** Incluir el contexto del Macro Dashboard (riesgo, tasas, inflación, curva). */
  includeMacro?: boolean;
  /** Incluir el contexto del portafolio (posiciones, asignación, concentración). */
  includePortfolio?: boolean;
}

// Config del iframe via variables de entorno del frontend (NUNCA API keys).
export const CHATGPT_IFRAME_URL: string =
  (import.meta.env.VITE_CHATGPT_IFRAME_URL as string | undefined) ?? "https://chatgpt.com/";
// chatgpt.com BLOQUEA el embedding (X-Frame-Options/CSP de OpenAI): el iframe
// solo se intenta si se activa explicitamente; por defecto se muestra la guia
// de "copiar prompt -> abrir en pestaña nueva".
export const CHATGPT_IFRAME_ENABLED: boolean =
  (import.meta.env.VITE_ENABLE_CHATGPT_IFRAME as string | undefined) === "true";
export const CHATGPT_FALLBACK_NEW_TAB: boolean =
  (import.meta.env.VITE_CHATGPT_IFRAME_FALLBACK_NEW_TAB as string | undefined) !== "false";
