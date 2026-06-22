// Mostrar/ocultar dibujos por GRÁFICA DE ORIGEN (chart_1…chart_6). Los dibujos
// son del análisis (se replican en las seis), pero el usuario puede ocultar los
// creados desde una gráfica; el toggle actúa GLOBAL (en las seis) y es una
// preferencia de UI por workspace + acción (persistida por navegador).

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Clave de toggle: workspace + símbolo + gráfica de origen. */
export function originVisKey(
  c030Id: number | string | undefined,
  symbol: string,
  slotId: string
): string {
  return `${c030Id ?? "_"}:${symbol.toUpperCase()}:${slotId}`;
}

interface DrawingOriginVisibilityState {
  /** Solo guarda los OCULTOS (`true`); ausente = visible. */
  hidden: Record<string, true>;
  isHidden: (c030Id: number | string | undefined, symbol: string, slotId: string) => boolean;
  toggle: (c030Id: number | string | undefined, symbol: string, slotId: string) => void;
}

export const useDrawingOriginVisibilityStore = create<DrawingOriginVisibilityState>()(
  persist(
    (set, get) => ({
      hidden: {},

      isHidden(c030Id, symbol, slotId) {
        return get().hidden[originVisKey(c030Id, symbol, slotId)] === true;
      },

      toggle(c030Id, symbol, slotId) {
        const key = originVisKey(c030Id, symbol, slotId);
        const next = { ...get().hidden };
        if (next[key]) delete next[key];
        else next[key] = true;
        set({ hidden: next });
      },
    }),
    {
      name: "tradingPlatform.drawingOriginVisibility",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DrawingOriginVisibilityState>;
        const hidden = p.hidden && typeof p.hidden === "object" ? p.hidden : {};
        return { ...current, hidden };
      },
    }
  )
);
