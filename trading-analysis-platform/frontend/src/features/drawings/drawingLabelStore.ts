// Preferencia GLOBAL: mostrar las etiquetas de precio en los extremos de las
// líneas. Por defecto activada. Persistida por navegador (no en SQL).

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface DrawingLabelState {
  showPriceLabels: boolean;
  toggle: () => void;
  setShowPriceLabels: (value: boolean) => void;
}

export const useDrawingLabelStore = create<DrawingLabelState>()(
  persist(
    (set, get) => ({
      showPriceLabels: true,
      toggle: () => set({ showPriceLabels: !get().showPriceLabels }),
      setShowPriceLabels: (value) => set({ showPriceLabels: value }),
    }),
    {
      name: "tradingPlatform.drawingPriceLabels",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DrawingLabelState>;
        return {
          ...current,
          showPriceLabels:
            typeof p.showPriceLabels === "boolean" ? p.showPriceLabels : true,
        };
      },
    }
  )
);
