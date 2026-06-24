// Estado de la PLANTILLA por defecto de las seis gráficas (preferencia de
// usuario C092). SQL es la fuente de verdad; este store solo cachea la plantilla
// efectiva en memoria para que Guardar/Restablecer tengan efecto VISIBLE sin
// recargar la página, y para que la UI distinga "plantilla guardada" de la
// configuración del análisis actual.

import { create } from "zustand";
import {
  userPreferencesApi,
  type ChartLayoutTemplate,
} from "./userPreferencesApi";
import type { ChartSlotConfig } from "./chartWorkspaceTypes";

interface ChartTemplateState {
  /** Plantilla efectiva (USER o SYSTEM); null hasta la primera carga. */
  template: ChartLayoutTemplate | null;
  loading: boolean;
  saving: boolean;
  error: string | null;

  /** Carga la plantilla efectiva del backend (idempotente). */
  load: (opts?: { force?: boolean }) => Promise<void>;
  /** Guarda los seis slots como plantilla del usuario y refresca el estado. */
  save: (slots: ChartSlotConfig[]) => Promise<ChartLayoutTemplate | null>;
  /** Restablece la plantilla del sistema y refresca el estado. */
  reset: () => Promise<ChartLayoutTemplate | null>;
}

export const useChartTemplateStore = create<ChartTemplateState>((set, get) => ({
  template: null,
  loading: false,
  saving: false,
  error: null,

  async load(opts) {
    if (get().loading) return;
    if (get().template && !opts?.force) return; // ya cargada
    set({ loading: true, error: null });
    try {
      const template = await userPreferencesApi.getTemplate();
      set({ template, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  async save(slots) {
    set({ saving: true, error: null });
    try {
      const template = await userPreferencesApi.saveTemplate(slots);
      set({ template, saving: false });
      return template;
    } catch (err) {
      set({ saving: false, error: (err as Error).message });
      return null;
    }
  },

  async reset() {
    set({ saving: true, error: null });
    try {
      const template = await userPreferencesApi.resetTemplate();
      set({ template, saving: false });
      return template;
    } catch (err) {
      set({ saving: false, error: (err as Error).message });
      return null;
    }
  },
}));
