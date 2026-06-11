// Estado del analisis de canal: seleccion manual de 2 Free Lines + referencia.

import { create } from "zustand";
import type { DetectedChannel } from "./channelAutoDetection";
import type { ChannelReferenceType, ChannelRiskRewardResult } from "./channelRiskRewardTypes";

interface ChannelRiskRewardState {
  upperDrawingId: string | null;
  lowerDrawingId: string | null;
  referenceType: ChannelReferenceType;
  /** Resultado EFECTIVO publicado (auto por defecto; manual si hay override).
   *  Lo leen los prompts de IA y el badge de las graficas. */
  result: ChannelRiskRewardResult | null;
  /** Mejor canal auto-detectado (con confianza) y alternativas. */
  autoBest: DetectedChannel | null;
  autoAlternates: DetectedChannel[];
  /** true cuando el usuario fuerza la seleccion manual. */
  manualOverride: boolean;

  setUpper: (drawingId: string | null) => void;
  setLower: (drawingId: string | null) => void;
  swap: () => void;
  setReferenceType: (type: ChannelReferenceType) => void;
  setResult: (result: ChannelRiskRewardResult | null) => void;
  setAutoDetection: (best: DetectedChannel | null, alternates: DetectedChannel[]) => void;
  setManualOverride: (value: boolean) => void;
  reset: () => void;
}

export const useChannelRiskRewardStore = create<ChannelRiskRewardState>((set) => ({
  upperDrawingId: null,
  lowerDrawingId: null,
  referenceType: "current_price",
  result: null,
  autoBest: null,
  autoAlternates: [],
  manualOverride: false,

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
  setAutoDetection(best, alternates) {
    set({ autoBest: best, autoAlternates: alternates });
  },
  setManualOverride(value) {
    set({ manualOverride: value });
  },
  reset() {
    set({
      upperDrawingId: null,
      lowerDrawingId: null,
      result: null,
      autoBest: null,
      autoAlternates: [],
      manualOverride: false,
    });
  },
}));
