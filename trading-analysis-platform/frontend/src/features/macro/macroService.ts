// Llamadas a la API del Macro Dashboard (siempre vía apiClient con Bearer).
import { apiClient } from "@/services/apiClient";
import type { MacroOverviewResponse } from "./macroTypes";

export const macroService = {
  getOverview(forceRefresh = false): Promise<MacroOverviewResponse> {
    const q = forceRefresh ? "?forceRefresh=true" : "";
    return apiClient.get(`/macro/overview${q}`);
  },
};
