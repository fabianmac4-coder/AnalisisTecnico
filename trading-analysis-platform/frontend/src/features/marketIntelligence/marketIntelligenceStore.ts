// Estado global de Inteligencia de Mercado (overview agregado).
// Proxy de sentimiento; NO es asesoría financiera.
import { create } from "zustand";
import { marketIntelligenceService } from "./marketIntelligenceService";
import type { MarketIntelligenceOverview } from "./marketIntelligenceTypes";

interface MarketIntelligenceState {
  overview: MarketIntelligenceOverview | null;
  loading: boolean;
  error: string | null;
  load: (forceRefresh?: boolean) => Promise<void>;
}

export const useMarketIntelligenceStore = create<MarketIntelligenceState>((set) => ({
  overview: null,
  loading: false,
  error: null,

  async load(forceRefresh = false) {
    set({ loading: true, error: null });
    try {
      const overview = await marketIntelligenceService.getOverview(forceRefresh);
      set({ overview, loading: false });
    } catch (err) {
      set({
        loading: false,
        error:
          (err as Error).message ||
          "La inteligencia de mercado no está disponible por ahora",
      });
    }
  },
}));
