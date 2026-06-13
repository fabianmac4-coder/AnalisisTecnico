import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PRESET_KEYS } from "@/utils/timeframes";
import { DEFAULT_TIMEFRAME_DRAWING_COLORS } from "@/features/drawings/colors";
import type { DrawingVisibilityFilters } from "@/features/drawings/drawingFilters";
import {
  DEFAULT_GLOBAL_INDICATORS,
  normalizeIndicatorConfigs,
  type GlobalIndicatorConfig,
  type IndicatorStyle,
} from "@/features/indicators/globalIndicators";

function allTimeframesVisible(): DrawingVisibilityFilters {
  return PRESET_KEYS.reduce(
    (acc, k) => {
      acc[k] = true;
      return acc;
    },
    {} as DrawingVisibilityFilters
  );
}

interface LayoutState {
  sidebarCollapsed: boolean;
  theme: "dark" | "light";

  // Filtros de visibilidad de dibujos por temporalidad de origen (global).
  drawingVisibilityFilters: DrawingVisibilityFilters;
  // Color de dibujo por temporalidad de origen (clave de preset o contextKey).
  timeframeDrawingColors: Record<string, string>;
  // Indicadores globales (se aplican a las seis graficas).
  globalIndicators: GlobalIndicatorConfig[];

  toggleSidebar: () => void;
  setTheme: (theme: "dark" | "light") => void;
  toggleDrawingTimeframe: (preset: string) => void;
  setTimeframeColor: (preset: string, color: string) => void;
  toggleIndicator: (id: string) => void;
  /** Actualiza params y/o estilo de un indicador (recalcula y persiste). */
  updateIndicatorConfig: (
    id: string,
    changes: { params?: Record<string, number | string | boolean>; style?: IndicatorStyle }
  ) => void;
  /** Restaura un indicador a sus valores por defecto (mantiene visibilidad). */
  resetIndicator: (id: string) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      theme: "dark",
      drawingVisibilityFilters: allTimeframesVisible(),
      timeframeDrawingColors: { ...DEFAULT_TIMEFRAME_DRAWING_COLORS },
      globalIndicators: DEFAULT_GLOBAL_INDICATORS.map((i) => ({ ...i })),

      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setTheme: (theme) => set({ theme }),

      toggleDrawingTimeframe: (preset) =>
        set({
          drawingVisibilityFilters: {
            ...get().drawingVisibilityFilters,
            [preset]: !get().drawingVisibilityFilters[preset],
          },
        }),

      setTimeframeColor: (preset, color) =>
        set({
          timeframeDrawingColors: { ...get().timeframeDrawingColors, [preset]: color },
        }),

      toggleIndicator: (id) =>
        set({
          globalIndicators: get().globalIndicators.map((i) =>
            i.id === id ? { ...i, visible: !i.visible } : i
          ),
        }),

      updateIndicatorConfig: (id, changes) =>
        set({
          globalIndicators: get().globalIndicators.map((i) =>
            i.id === id
              ? {
                  ...i,
                  params: { ...i.params, ...(changes.params ?? {}) },
                  style: { ...i.style, ...(changes.style ?? {}) },
                }
              : i
          ),
        }),

      resetIndicator: (id) =>
        set({
          globalIndicators: get().globalIndicators.map((i) => {
            if (i.id !== id) return i;
            const def = DEFAULT_GLOBAL_INDICATORS.find((d) => d.id === id);
            if (!def) return i;
            return { ...def, visible: i.visible };
          }),
        }),
    }),
    {
      name: "tap.ui.v1",
      version: 3,
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        theme: s.theme,
        drawingVisibilityFilters: s.drawingVisibilityFilters,
        timeframeDrawingColors: s.timeframeDrawingColors,
        globalIndicators: s.globalIndicators,
      }),
      // Migra el estado viejo (summary view, ids antiguos de indicadores...).
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        // Descarta el concepto de "summary".
        delete p.currentView;
        delete p.summaryFilters;
        // Re-mapea una posible clave 4Y_1D en filtros/colores persistidos.
        for (const field of ["drawingVisibilityFilters", "timeframeDrawingColors"]) {
          const obj = p[field] as Record<string, unknown> | undefined;
          if (obj && "4Y_1D" in obj) {
            obj["4Y_1W"] = obj["4Y_1D"];
            delete obj["4Y_1D"];
          }
        }
        // Indicadores: del modelo viejo (ids SMA_20...) al modelo rico actual,
        // conservando la visibilidad elegida por el usuario.
        p.globalIndicators = normalizeIndicatorConfigs(p.globalIndicators);
        return p;
      },
      // merge corre SIEMPRE al hidratar (migrate solo si cambia la version):
      // normaliza/funde con defaults para que un estado persistido corrupto o
      // incompleto jamas tire la app.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LayoutState> & Record<string, unknown>;
        return {
          ...current,
          sidebarCollapsed:
            typeof p.sidebarCollapsed === "boolean" ? p.sidebarCollapsed : current.sidebarCollapsed,
          theme: p.theme === "light" || p.theme === "dark" ? p.theme : current.theme,
          drawingVisibilityFilters: {
            ...allTimeframesVisible(),
            ...(typeof p.drawingVisibilityFilters === "object" && p.drawingVisibilityFilters !== null
              ? (p.drawingVisibilityFilters as Record<string, boolean>)
              : {}),
          },
          timeframeDrawingColors: {
            ...DEFAULT_TIMEFRAME_DRAWING_COLORS,
            ...(typeof p.timeframeDrawingColors === "object" && p.timeframeDrawingColors !== null
              ? (p.timeframeDrawingColors as Record<string, string>)
              : {}),
          },
          globalIndicators: normalizeIndicatorConfigs(p.globalIndicators),
        };
      },
    }
  )
);
