// Estado del Modo Replay (práctica histórica). Acotado a la SESIÓN del símbolo
// activo: al cambiar de acción se desactiva (ChartGrid). Es estado de UI en
// memoria; no se persiste ni viaja a SQL.

import { create } from "zustand";

interface ReplayState {
  /** Replay activo en todas las gráficas del workspace activo. */
  enabled: boolean;
  /** Símbolo para el que se activó (para acotar la sesión). */
  symbol: string | null;
  /** Corte temporal (ms UTC): se ocultan las velas con time > cursorTime. */
  cursorTime: number | null;
  /** Multiplicador de velocidad de reproducción (1/2/5/10). */
  speedMultiplier: number;
  /** Reproducción automática en curso. */
  playing: boolean;
  /** "Seleccionar punto de inicio" armado: el próximo clic en una gráfica fija el corte. */
  selecting: boolean;

  enable: (symbol: string, cursorTime: number | null) => void;
  disable: () => void;
  setCursor: (time: number | null) => void;
  setSelecting: (on: boolean) => void;
  setSpeed: (multiplier: number) => void;
  setPlaying: (on: boolean) => void;
}

export const useReplayStore = create<ReplayState>((set) => ({
  enabled: false,
  symbol: null,
  cursorTime: null,
  speedMultiplier: 1,
  playing: false,
  selecting: false,

  enable: (symbol, cursorTime) =>
    set({ enabled: true, symbol, cursorTime, playing: false, selecting: false }),
  disable: () =>
    set({ enabled: false, cursorTime: null, playing: false, selecting: false }),
  // Fijar el cursor termina el modo "selección" (ya se eligió el punto).
  setCursor: (time) => set({ cursorTime: time, selecting: false }),
  setSelecting: (on) => set({ selecting: on }),
  setSpeed: (multiplier) => set({ speedMultiplier: multiplier }),
  setPlaying: (on) => set({ playing: on }),
}));
