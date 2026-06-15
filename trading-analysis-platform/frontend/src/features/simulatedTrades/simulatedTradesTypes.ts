// Tipos de entradas simuladas / paper trading (forma de la API /simulated-trades).
// NO es trading real: seguimiento hipotetico personal.

export type SimulatedTradeType = "LONG" | "SHORT";
export type SimulatedTradeStatus = "ABIERTA" | "CERRADA";

export interface SimulatedTrade {
  id: number;
  c010Id: number;
  c030Id?: number | null;
  symbol: string;
  type: SimulatedTradeType;
  entryPrice: number;
  quantity: number | null;
  entryDate: string;
  sourceTimeframe: string | null;
  name: string | null;
  notes: string | null;
  status: SimulatedTradeStatus;
  color: string | null;
  exitPrice: number | null;
  exitDate: string | null;
  exitReason: string | null;
  currentPrice: number | null;
  gainLossAmount: number | null;
  gainLossPercent: number | null;
  totalGainLossAmount: number | null;
  daysSinceEntry: number;
  visible: boolean;
}

/** Detalle con el snapshot de análisis (MetadataJSON / AnalisisJSON). */
export interface SimulatedTradeDetail extends SimulatedTrade {
  metadata?: Record<string, unknown> | null;
  analysisSnapshot?: Record<string, unknown> | null;
}

export interface SimulatedTradeCreate {
  symbol: string;
  c030Id?: number | null;
  type: SimulatedTradeType;
  entryPrice: number;
  quantity?: number | null;
  entryDate?: string;
  sourceTimeframe?: string | null;
  name?: string | null;
  notes?: string | null;
  color?: string | null;
  // Tesis de la entrada (se guarda en AnalisisJSON.simulatedEntryThesis).
  entryThesis?: string | null;
  bullishScenario?: string | null;
  bearishScenario?: string | null;
  invalidationLevel?: string | number | null;
  targetArea?: string | number | null;
  // Contexto crudo del clic/gráfica y snapshot de análisis al crear.
  metadata?: Record<string, unknown> | null;
  analysisSnapshot?: Record<string, unknown> | null;
}
