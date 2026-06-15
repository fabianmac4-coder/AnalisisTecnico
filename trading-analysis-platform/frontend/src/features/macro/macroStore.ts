// Estado global del Macro Dashboard. Informativo; no es asesoría financiera.
import { create } from "zustand";
import { macroService } from "./macroService";
import type { MacroOverviewResponse } from "./macroTypes";

interface MacroState {
  overview: MacroOverviewResponse | null;
  loading: boolean;
  error: string | null;
  load: (forceRefresh?: boolean) => Promise<void>;
}

export const useMacroStore = create<MacroState>((set) => ({
  overview: null,
  loading: false,
  error: null,

  async load(forceRefresh = false) {
    set({ loading: true, error: null });
    try {
      const overview = await macroService.getOverview(forceRefresh);
      set({ overview, loading: false });
    } catch (err) {
      set({
        loading: false,
        error:
          (err as Error).message ||
          "El macro dashboard no está disponible por ahora",
      });
    }
  },
}));
