// Estado del analisis de canal: auto-deteccion POR TEMPORALIDAD + seleccion
// manual de 2 lineas como respaldo. La grafica "activa" (ultimo panel
// clickeado) decide que canal muestra el panel izquierdo y viaja a la IA.

import { create } from "zustand";
import type { DetectedChannel } from "./channelAutoDetection";
import type { ChannelReferenceType, ChannelRiskRewardResult } from "./channelRiskRewardTypes";

interface ChannelRiskRewardState {
  upperDrawingId: string | null;
  lowerDrawingId: string | null;
  referenceType: ChannelReferenceType;
  /** Resultado EFECTIVO publicado (auto del panel activo; manual si override).
   *  Lo leen los prompts de IA. */
  result: ChannelRiskRewardResult | null;
  /** Mejor canal AUTO por temporalidad (clave = preset). Cada badge de
   *  grafica lee SOLO su preset: sin contaminacion entre temporalidades. */
  autoByTimeframe: Partial<Record<string, DetectedChannel | null>>;
  /** Canal auto de la temporalidad ACTIVA (para el panel izquierdo y la IA). */
  autoBest: DetectedChannel | null;
  autoAlternates: DetectedChannel[];
  /** true cuando el usuario fuerza la seleccion manual. */
  manualOverride: boolean;
  /** Preset de la grafica enfocada (click en un panel); null = automatica. */
  activeChartPreset: string | null;

  setUpper: (drawingId: string | null) => void;
  setLower: (drawingId: string | null) => void;
  swap: () => void;
  setReferenceType: (type: ChannelReferenceType) => void;
  setResult: (result: ChannelRiskRewardResult | null) => void;
  setAutoByTimeframe: (map: Partial<Record<string, DetectedChannel | null>>) => void;
  setAutoDetection: (best: DetectedChannel | null, alternates: DetectedChannel[]) => void;
  setManualOverride: (value: boolean) => void;
  setActiveChartPreset: (preset: string | null) => void;
  reset: () => void;
}

export const useChannelRiskRewardStore = create<ChannelRiskRewardState>((set) => ({
  upperDrawingId: null,
  lowerDrawingId: null,
  referenceType: "current_price",
  result: null,
  autoByTimeframe: {},
  autoBest: null,
  autoAlternates: [],
  manualOverride: false,
  activeChartPreset: null,

  setUpper(drawingId) {
    set({ upperDrawingId: drawingId });
  },
  setLower(drawingId) {
    set({ lowerDrawingId: drawingId });
  },
  swap() {
    set((s) => ({ upperDrawingId: s.lowerDrawingId, lowerDrawingId: s.upperDrawingId }));
  },
  setReferenceType(type) {
    set({ referenceType: type });
  },
  setResult(result) {
    set({ result });
  },
  setAutoByTimeframe(map) {
    set({ autoByTimeframe: map });
  },
  setAutoDetection(best, alternates) {
    set({ autoBest: best, autoAlternates: alternates });
  },
  setManualOverride(value) {
    set({ manualOverride: value });
  },
  setActiveChartPreset(preset) {
    set({ activeChartPreset: preset });
  },
  reset() {
    set({
      upperDrawingId: null,
      lowerDrawingId: null,
      result: null,
      autoByTimeframe: {},
      autoBest: null,
      autoAlternates: [],
      manualOverride: false,
      activeChartPreset: null,
    });
  },
}));
