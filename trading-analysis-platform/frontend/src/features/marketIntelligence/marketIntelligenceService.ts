// Llamadas a la API de Inteligencia de Mercado (siempre vía apiClient con Bearer).
import { apiClient } from "@/services/apiClient";
import type { MarketIntelligenceOverview, SentimentDto } from "./marketIntelligenceTypes";

export const marketIntelligenceService = {
  getOverview(forceRefresh = false): Promise<MarketIntelligenceOverview> {
    const q = forceRefresh ? "?forceRefresh=true" : "";
    return apiClient.get(`/market-intelligence/overview${q}`);
  },

  getSentiment(forceRefresh = false): Promise<SentimentDto> {
    const q = forceRefresh ? "?forceRefresh=true" : "";
    return apiClient.get(`/market-intelligence/sentiment${q}`);
  },
};
