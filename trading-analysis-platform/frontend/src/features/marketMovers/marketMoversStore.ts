// Estado del modulo de market movers.

import { create } from "zustand";
import { marketMoversService } from "./marketMoversService";
import type { AllMoversResponse, MoversTabKey } from "./marketMoversTypes";

interface MarketMoversState {
  data: AllMoversResponse | null;
  activeTab: MoversTabKey;
  loading: boolean;
  error: string | null;

  load: (forceRefresh?: boolean) => Promise<void>;
  setTab: (tab: MoversTabKey) => void;
}

export const useMarketMoversStore = create<MarketMoversState>((set) => ({
  data: null,
  activeTab: "trending",
  loading: false,
  error: null,

  async load(forceRefresh = false) {
    set({ loading: true, error: null });
    try {
      const data = await marketMoversService.getAll(forceRefresh);
      set({ data, loading: false });
    } catch (err) {
      // El ultimo snapshot mostrado se conserva.
      set({
        loading: false,
        error:
          (err as Error).message || "Los market movers no están disponibles por ahora",
      });
    }
  },

  setTab(tab) {
    set({ activeTab: tab });
  },
}));
