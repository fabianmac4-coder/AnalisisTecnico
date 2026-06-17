// Estado reactivo de la zona horaria de las gráficas. Store dedicado (no toca
// la forma persistida de layoutStore) que persiste en localStorage al cambiar.
import { create } from "zustand";
import type { ChartTimezoneSetting } from "./chartTimezoneTypes";
import { loadTimezoneSetting, saveTimezoneSetting } from "./chartTimezoneUtils";

interface ChartTimezoneState {
  setting: ChartTimezoneSetting;
  setSetting: (s: ChartTimezoneSetting) => void;
}

export const useChartTimezoneStore = create<ChartTimezoneState>((set) => ({
  setting: loadTimezoneSetting(),
  setSetting: (setting) => {
    saveTimezoneSetting(setting);
    set({ setting });
  },
}));
