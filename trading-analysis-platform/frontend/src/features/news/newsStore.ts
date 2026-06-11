// Estado de noticias: globales (pagina /news) y por simbolo (panel lateral).

import { create } from "zustand";
import { newsService } from "./newsService";
import type { NewsItemDto } from "./newsTypes";

interface NewsState {
  // Globales
  globalItems: NewsItemDto[];
  globalCategory: string;
  globalSource: string;
  globalLastUpdated: string | null;
  globalLoading: boolean;
  globalError: string | null;
  globalWarnings: string[];

  // Top Trending Stocks Today (seccion destacada de /news)
  trendingItems: NewsItemDto[];
  trendingLastUpdated: string | null;
  trendingLoading: boolean;

  // Por simbolo
  symbolItemsBySymbol: Record<string, NewsItemDto[]>;
  symbolLastUpdated: Record<string, string | null>;
  symbolLoading: boolean;
  symbolError: string | null;

  loadGlobal: (category?: string, forceRefresh?: boolean) => Promise<void>;
  setCategory: (category: string) => Promise<void>;
  setSource: (source: string) => Promise<void>;
  loadTrending: (forceRefresh?: boolean) => Promise<void>;
  loadSymbol: (symbol: string, forceRefresh?: boolean) => Promise<void>;
}

export const useNewsStore = create<NewsState>((set, get) => ({
  globalItems: [],
  globalCategory: "All",
  globalSource: "all",
  globalLastUpdated: null,
  globalLoading: false,
  globalError: null,
  globalWarnings: [],

  trendingItems: [],
  trendingLastUpdated: null,
  trendingLoading: false,

  symbolItemsBySymbol: {},
  symbolLastUpdated: {},
  symbolLoading: false,
  symbolError: null,

  async loadGlobal(category, forceRefresh = false) {
    const cat = category ?? get().globalCategory;
    set({ globalLoading: true, globalError: null });
    try {
      const res = await newsService.getGlobal(cat, forceRefresh, 50, get().globalSource);
      set({
        globalItems: res.items,
        globalLastUpdated: res.lastUpdated,
        globalWarnings: res.warnings,
        globalLoading: false,
      });
    } catch (err) {
      // Los datos viejos se conservan en pantalla.
      set({
        globalLoading: false,
        globalError:
          (err as Error).message || "No se pudieron cargar las noticias",
      });
    }
  },

  async setCategory(category) {
    set({ globalCategory: category });
    await get().loadGlobal(category, false);
  },

  async setSource(source) {
    set({ globalSource: source });
    await get().loadGlobal(undefined, false);
  },

  async loadTrending(forceRefresh = false) {
    set({ trendingLoading: true });
    try {
      const res = await newsService.getTopTrending(forceRefresh);
      set({
        trendingItems: res.items,
        trendingLastUpdated: res.lastUpdated,
        trendingLoading: false,
      });
    } catch {
      set({ trendingLoading: false }); // se conserva lo que hubiera
    }
  },

  async loadSymbol(symbol, forceRefresh = false) {
    set({ symbolLoading: true, symbolError: null });
    try {
      const res = await newsService.getSymbol(symbol, forceRefresh);
      set((s) => ({
        symbolItemsBySymbol: { ...s.symbolItemsBySymbol, [symbol]: res.items },
        symbolLastUpdated: { ...s.symbolLastUpdated, [symbol]: res.lastUpdated },
        symbolLoading: false,
      }));
    } catch (err) {
      set({
        symbolLoading: false,
        symbolError:
          (err as Error).message || "No se pudieron cargar las noticias del ticker",
      });
    }
  },
}));
