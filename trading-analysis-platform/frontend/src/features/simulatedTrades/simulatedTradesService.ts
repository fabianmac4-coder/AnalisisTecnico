// Llamadas a la API de entradas simuladas (siempre via apiClient con Bearer).

import { apiClient } from "@/services/apiClient";
import type {
  SimulatedTrade,
  SimulatedTradeCreate,
  SimulatedTradeDetail,
} from "./simulatedTradesTypes";

export interface EntryThesisInput {
  scenario?: string | null;
  bullishCase?: string | null;
  bearishCase?: string | null;
  invalidation?: string | null;
  targetArea?: string | null;
}

export const simulatedTradesService = {
  list(symbol: string, c030Id?: number | null): Promise<SimulatedTrade[]> {
    const q = new URLSearchParams({ symbol });
    if (c030Id != null) q.set("c030Id", String(c030Id));
    return apiClient.get(`/simulated-trades?${q.toString()}`);
  },

  detail(id: number): Promise<SimulatedTradeDetail> {
    return apiClient.get(`/simulated-trades/${id}`);
  },

  create(payload: SimulatedTradeCreate): Promise<SimulatedTrade> {
    return apiClient.post("/simulated-trades", payload);
  },

  update(
    id: number,
    changes: Partial<{
      name: string;
      notes: string;
      quantity: number;
      color: string;
      visible: boolean;
      thesis: EntryThesisInput;
    }>
  ): Promise<SimulatedTrade> {
    return apiClient.patch(`/simulated-trades/${id}`, changes);
  },

  close(
    id: number,
    exitPrice: number,
    reason?: string
  ): Promise<SimulatedTrade> {
    return apiClient.post(`/simulated-trades/${id}/close`, {
      exitPrice,
      reason,
    });
  },

  remove(id: number): Promise<void> {
    return apiClient.delete(`/simulated-trades/${id}`);
  },
};
