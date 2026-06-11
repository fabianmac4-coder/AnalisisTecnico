// Llamadas a la API de noticias (Bearer via apiClient; jamas scrapea sitios).

import { apiClient } from "@/services/apiClient";
import type { GlobalNewsResponse, SymbolNewsResponse } from "./newsTypes";

export const newsService = {
  getGlobal(
    category?: string,
    forceRefresh = false,
    limit = 50,
    source: string = "all"
  ): Promise<GlobalNewsResponse> {
    const q = new URLSearchParams({ limit: String(limit) });
    if (category && category !== "All") q.set("category", category);
    if (source && source !== "all") q.set("source", source);
    if (forceRefresh) q.set("forceRefresh", "true");
    return apiClient.get(`/news/global?${q.toString()}`);
  },

  getTopTrending(forceRefresh = false, limit = 30): Promise<GlobalNewsResponse> {
    const q = new URLSearchParams({ limit: String(limit) });
    if (forceRefresh) q.set("forceRefresh", "true");
    return apiClient.get(`/news/top-trending-stocks-today?${q.toString()}`);
  },

  getSymbol(
    symbol: string,
    forceRefresh = false,
    limit = 10
  ): Promise<SymbolNewsResponse> {
    const q = new URLSearchParams({ limit: String(limit) });
    if (forceRefresh) q.set("forceRefresh", "true");
    return apiClient.get(`/news/symbol/${encodeURIComponent(symbol)}?${q.toString()}`);
  },
};
