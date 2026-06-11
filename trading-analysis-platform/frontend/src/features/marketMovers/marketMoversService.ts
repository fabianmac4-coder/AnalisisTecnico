// Llamadas a la API de market movers (Bearer via apiClient).

import { apiClient } from "@/services/apiClient";
import type { AllMoversResponse } from "./marketMoversTypes";

export const marketMoversService = {
  getAll(forceRefresh = false): Promise<AllMoversResponse> {
    const q = forceRefresh ? "?forceRefresh=true" : "";
    return apiClient.get(`/market-movers${q}`);
  },

  refreshAll(): Promise<AllMoversResponse> {
    return apiClient.post("/market-movers/refresh");
  },
};
