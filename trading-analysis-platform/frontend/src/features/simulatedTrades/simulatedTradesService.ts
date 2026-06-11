// Llamadas a la API de entradas simuladas (siempre via apiClient con Bearer).

import { apiClient } from "@/services/apiClient";
import type { SimulatedTrade, SimulatedTradeCreate } from "./simulatedTradesTypes";

export const simulatedTradesService = {
  list(symbol: string): Promise<SimulatedTrade[]> {
    const q = new URLSearchParams({ symbol });
    return apiClient.get(`/simulated-trades?${q.toString()}`);
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
