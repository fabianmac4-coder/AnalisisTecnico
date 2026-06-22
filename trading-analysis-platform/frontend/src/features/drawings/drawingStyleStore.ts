// Preferencia de ESTILO de dibujo POR PANEL (chart slot), NO por temporalidad.
//
// Antes el color de un dibujo nuevo se tomaba de `timeframeDrawingColors[
// sourceTimeframe]`, así que al cambiar el range/interval de un panel cambiaba
// su "color seleccionado". Eso era incorrecto: el estilo debe ser del PANEL.
//
// Clave: `${c030Id}:${slotId}` (workspace + slot). Persistido por navegador en
// `tradingPlatform.drawingPanelStyles`. La VISIBILIDAD de dibujos sigue acotada
// por temporalidad (eso es correcto) — esto solo gobierna el estilo de los
// dibujos NUEVOS de cada panel. Los dibujos ya guardados conservan su EstiloJSON.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LineStyleName } from "./drawingTypes";
import { DEFAULT_DRAWING_COLOR } from "./colors";

export interface DrawingPanelStyle {
  color: string;
  lineWidth: number;
  lineStyle: LineStyleName;
}

export const DEFAULT_PANEL_STYLE: DrawingPanelStyle = {
  color: DEFAULT_DRAWING_COLOR,
  lineWidth: 2,
  lineStyle: "solid",
};

// Color por defecto DISTINTO por SLOT (no por temporalidad). Así cada Gráfica
// tiene su propio color desde el inicio aunque varios paneles compartan el mismo
// range/interval. Mapea por posición a los colores históricos.
export const DEFAULT_SLOT_COLORS: Record<string, string> = {
  chart_1: "#f97316", // naranja
  chart_2: "#3b82f6", // azul
  chart_3: "#ef4444", // rojo
  chart_4: "#a855f7", // morado
  chart_5: "#22c55e", // verde
  chart_6: "#eab308", // amarillo
};
const SLOT_COLOR_CYCLE = Object.values(DEFAULT_SLOT_COLORS);

/** Color por defecto de un slot (chart_1…chart_6; cicla para slots extra). */
export function defaultColorForSlot(slotId: string): string {
  const fixed = DEFAULT_SLOT_COLORS[slotId];
  if (fixed) return fixed;
  const m = /(\d+)/.exec(slotId);
  if (m) {
    const idx = (parseInt(m[1], 10) - 1) % SLOT_COLOR_CYCLE.length;
    if (idx >= 0) return SLOT_COLOR_CYCLE[idx];
  }
  return DEFAULT_DRAWING_COLOR;
}

/** Estilo por defecto de un slot: SIEMPRE un objeto NUEVO (sin referencias
 *  compartidas) con el color propio del slot. */
function defaultStyleForSlot(slotId: string): DrawingPanelStyle {
  return { ...DEFAULT_PANEL_STYLE, color: defaultColorForSlot(slotId) };
}

/** Clave de panel. c030Id ausente (dibujos heredados) cae a "_". */
export function panelStyleKey(c030Id: number | string | undefined, slotId: string): string {
  return `${c030Id ?? "_"}:${slotId}`;
}

interface DrawingStyleState {
  panelStyles: Record<string, DrawingPanelStyle>;
  /** Estilo efectivo del panel (el guardado o el default). NUNCA por timeframe. */
  getPanelStyle: (c030Id: number | string | undefined, slotId: string) => DrawingPanelStyle;
  /** Actualiza (merge) el estilo de UN panel; no toca los demás. */
  setPanelStyle: (
    c030Id: number | string | undefined,
    slotId: string,
    patch: Partial<DrawingPanelStyle>
  ) => void;
  /** Siembra el estilo del panel SOLO si no existe (para defaults bonitos). */
  ensurePanelStyle: (
    c030Id: number | string | undefined,
    slotId: string,
    seed: Partial<DrawingPanelStyle>
  ) => void;
}

export const useDrawingStyleStore = create<DrawingStyleState>()(
  persist(
    (set, get) => ({
      panelStyles: {},

      getPanelStyle(c030Id, slotId) {
        // Sin estilo guardado ⇒ objeto NUEVO con el color propio del slot
        // (nunca una referencia compartida; nunca derivado del timeframe).
        return get().panelStyles[panelStyleKey(c030Id, slotId)] ?? defaultStyleForSlot(slotId);
      },

      setPanelStyle(c030Id, slotId, patch) {
        const key = panelStyleKey(c030Id, slotId);
        const current = get().panelStyles[key] ?? defaultStyleForSlot(slotId);
        set({
          panelStyles: { ...get().panelStyles, [key]: { ...current, ...patch } },
        });
      },

      ensurePanelStyle(c030Id, slotId, seed) {
        const key = panelStyleKey(c030Id, slotId);
        if (get().panelStyles[key]) return; // ya existe -> no pisar
        set({
          panelStyles: {
            ...get().panelStyles,
            [key]: { ...DEFAULT_PANEL_STYLE, ...seed },
          },
        });
      },
    }),
    {
      name: "tradingPlatform.drawingPanelStyles",
      storage: createJSONStorage(() => localStorage),
      // Tolerante a estado viejo/corrupto: si panelStyles no es objeto, vacío.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DrawingStyleState>;
        const styles =
          p.panelStyles && typeof p.panelStyles === "object" ? p.panelStyles : {};
        return { ...current, panelStyles: styles };
      },
    }
  )
);
