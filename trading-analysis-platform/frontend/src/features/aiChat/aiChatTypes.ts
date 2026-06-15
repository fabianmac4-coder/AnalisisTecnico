// Tipos del chat de IA (forma exacta de la API del backend /api/ai/*).

export interface AiConversation {
  id: number;
  title: string | null;
  symbol: string | null;
  yahooSymbol: string | null;
  model: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface SendMessagePayload {
  message: string;
  includeChartContext: boolean;
  includeDrawings: boolean;
  includeIndicators: boolean;
  includeNews: boolean;
  /** R/R de canal hipotético calculado en el frontend (opcional). */
  channelRiskReward?: Record<string, unknown>;
  /** Workspace de análisis activo (nombre + configuración de slots). */
  workspace?: Record<string, unknown>;
  /** Inteligencia de mercado (sentimiento + índices + movers + noticias). */
  marketIntelligence?: Record<string, unknown>;
  /** Contexto macro (riesgo, tasas, inflación, curva). */
  macro?: Record<string, unknown>;
  /** Contexto de portafolio (resumen/posiciones/asignación/riesgo). */
  portfolio?: Record<string, unknown>;
}

export interface SendMessageResponse {
  userMessage: AiMessage;
  assistantMessage: AiMessage;
}
