// Tipos de entradas simuladas / paper trading (forma de la API /simulated-trades).
// NO es trading real: seguimiento hipotetico personal.

export type SimulatedTradeType = "LONG" | "SHORT";
export type SimulatedTradeStatus = "ABIERTA" | "CERRADA";

export interface SimulatedTrade {
  id: number;
  c010Id: number;
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

export interface SimulatedTradeCreate {
  symbol: string;
  type: SimulatedTradeType;
  entryPrice: number;
  quantity?: number | null;
  entryDate?: string;
  sourceTimeframe?: string | null;
  name?: string | null;
  notes?: string | null;
  color?: string | null;
}
