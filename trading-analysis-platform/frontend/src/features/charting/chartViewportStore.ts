// Viewport (rango lógico/zoom) recordado por gráfica. En memoria de sesión: lo
// comparten el panel normal y la gráfica maximizada del MISMO slot, y sobrevive
// a remontajes (cambiar de gráfica maximizada). No se persiste en SQL.

import { create } from "zustand";
import type { LogicalRange } from "./chartViewport";

interface ChartViewportState {
  ranges: Record<string, LogicalRange>;
  getRange: (key: string) => LogicalRange | null;
  setRange: (key: string, range: LogicalRange) => void;
  clearRange: (key: string) => void;
}

export const useChartViewportStore = create<ChartViewportState>((set, get) => ({
  ranges: {},
  getRange: (key) => get().ranges[key] ?? null,
  setRange: (key, range) =>
    set((s) => ({ ranges: { ...s.ranges, [key]: range } })),
  clearRange: (key) =>
    set((s) => {
      const next = { ...s.ranges };
      delete next[key];
      return { ranges: next };
    }),
}));
