import { create } from "zustand";
import { scorecardConfigService } from "./scorecardConfigService";
import {
  DEFAULT_SCORECARD_CONFIG,
  type ScorecardConfig,
  type ScorecardConfigEntry,
} from "./scorecardConfigTypes";

interface ScorecardConfigState {
  /** Config DEFAULT del usuario (la que usa el scorecard). */
  defaultConfig: ScorecardConfigEntry | null;
  /** Todos los perfiles activos del usuario. */
  configs: ScorecardConfigEntry[];
  loading: boolean;
  saving: boolean;
  error: string | null;

  loadDefault: () => Promise<void>;
  loadConfigs: () => Promise<void>;
  /** Guarda (PATCH) la config indicada y devuelve true si tuvo éxito. */
  saveConfig: (
    c081Id: number,
    body: { name?: string; configuration?: ScorecardConfig }
  ) => Promise<boolean>;
  /** Crea un nuevo perfil (save as) y lo deja como default activo en memoria. */
  createConfig: (name: string, configuration: ScorecardConfig) => Promise<boolean>;
  /** Marca un perfil como default (el scorecard lo usará). */
  setDefault: (c081Id: number) => Promise<boolean>;
  /** Restaura la config DEFAULT del usuario a los valores del sistema. */
  resetDefault: () => Promise<boolean>;
}

function applyEntry(
  state: ScorecardConfigState,
  entry: ScorecardConfigEntry,
  makeDefault: boolean
): Partial<ScorecardConfigState> {
  const others = state.configs.filter((c) => c.c081Id !== entry.c081Id);
  const next = makeDefault
    ? [entry, ...others.map((c) => ({ ...c, isDefault: false }))]
    : [...others, entry];
  return {
    configs: next,
    defaultConfig: entry.isDefault || makeDefault ? entry : state.defaultConfig,
  };
}

export const useScorecardConfigStore = create<ScorecardConfigState>((set, get) => ({
  defaultConfig: null,
  configs: [],
  loading: false,
  saving: false,
  error: null,

  async loadDefault() {
    if (get().defaultConfig || get().loading) return;
    set({ loading: true, error: null });
    try {
      const entry = await scorecardConfigService.getDefault();
      set({ defaultConfig: entry, loading: false });
      void get().loadConfigs();
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  async loadConfigs() {
    try {
      const list = await scorecardConfigService.list();
      set({ configs: list });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  async saveConfig(c081Id, body) {
    set({ saving: true, error: null });
    try {
      const entry = await scorecardConfigService.update(c081Id, body);
      set((s) => ({ ...applyEntry(s, entry, entry.isDefault), saving: false }));
      return true;
    } catch (err) {
      set({ saving: false, error: (err as Error).message });
      return false;
    }
  },

  async createConfig(name, configuration) {
    set({ saving: true, error: null });
    try {
      const entry = await scorecardConfigService.create(name, { configuration });
      // Tras crearlo lo dejamos como default (se usará en el scorecard).
      const def = entry.isDefault
        ? entry
        : await scorecardConfigService.setDefault(entry.c081Id);
      set((s) => ({ ...applyEntry(s, def, true), saving: false }));
      return true;
    } catch (err) {
      set({ saving: false, error: (err as Error).message });
      return false;
    }
  },

  async setDefault(c081Id) {
    set({ saving: true, error: null });
    try {
      const entry = await scorecardConfigService.setDefault(c081Id);
      set((s) => ({ ...applyEntry(s, entry, true), saving: false }));
      return true;
    } catch (err) {
      set({ saving: false, error: (err as Error).message });
      return false;
    }
  },

  async resetDefault() {
    set({ saving: true, error: null });
    try {
      const entry = await scorecardConfigService.resetDefault();
      set((s) => ({ ...applyEntry(s, entry, true), saving: false }));
      return true;
    } catch (err) {
      set({ saving: false, error: (err as Error).message });
      return false;
    }
  },
}));

/** Pesos válidos solo si suman 100. */
export function weightsTotal(c: ScorecardConfig): number {
  const w = c.weights;
  return w.technical + w.fundamentals + w.news + w.sentiment;
}

/** Normaliza los pesos para que sumen 100 (proporcionalmente). */
export function normalizeWeights(c: ScorecardConfig): ScorecardConfig["weights"] {
  const total = weightsTotal(c);
  if (total <= 0) return { ...DEFAULT_SCORECARD_CONFIG.weights };
  const scale = 100 / total;
  const tech = Math.round(c.weights.technical * scale);
  const fund = Math.round(c.weights.fundamentals * scale);
  const news = Math.round(c.weights.news * scale);
  // El último absorbe el redondeo para garantizar suma 100.
  const sent = 100 - tech - fund - news;
  return { technical: tech, fundamentals: fund, news, sentiment: sent };
}
