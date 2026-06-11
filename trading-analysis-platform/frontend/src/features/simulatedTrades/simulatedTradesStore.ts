// Estado global de entradas simuladas (paper trading) por simbolo.
// Analisis HIPOTETICO: no ejecuta ordenes reales.

import { create } from "zustand";
import { simulatedTradesService } from "./simulatedTradesService";
import type { SimulatedTrade, SimulatedTradeCreate } from "./simulatedTradesTypes";

interface SimulatedTradesState {
  tradesBySymbol: Record<string, SimulatedTrade[]>;
  loading: boolean;
  error: string | null;
  /** Abre el modal de nueva entrada (lo consume SimulatedTradeModal). */
  modalOpen: boolean;

  openModal: () => void;
  closeModal: () => void;
  load: (symbol: string) => Promise<void>;
  create: (payload: SimulatedTradeCreate) => Promise<boolean>;
  update: (
    symbol: string,
    id: number,
    changes: Partial<{ name: string; notes: string; quantity: number; color: string; visible: boolean }>
  ) => Promise<void>;
  close: (symbol: string, id: number, exitPrice: number, reason?: string) => Promise<void>;
  remove: (symbol: string, id: number) => Promise<void>;
  /** Entradas ABIERTAS y visibles (para marcar en las graficas). */
  getOpenVisible: (symbol: string) => SimulatedTrade[];
}

export const useSimulatedTradesStore = create<SimulatedTradesState>((set, get) => ({
  tradesBySymbol: {},
  loading: false,
  error: null,
  modalOpen: false,

  openModal() {
    set({ modalOpen: true, error: null });
  },
  closeModal() {
    set({ modalOpen: false });
  },

  async load(symbol) {
    set({ loading: true, error: null });
    try {
      const trades = await simulatedTradesService.list(symbol);
      set((s) => ({
        tradesBySymbol: { ...s.tradesBySymbol, [symbol]: trades },
        loading: false,
      }));
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  async create(payload) {
    set({ error: null });
    try {
      const trade = await simulatedTradesService.create(payload);
      set((s) => ({
        tradesBySymbol: {
          ...s.tradesBySymbol,
          [payload.symbol]: [trade, ...(s.tradesBySymbol[payload.symbol] ?? [])],
        },
        modalOpen: false,
      }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message || "No se pudo guardar la entrada simulada" });
      return false;
    }
  },

  async update(symbol, id, changes) {
    try {
      const updated = await simulatedTradesService.update(id, changes);
      set((s) => ({
        tradesBySymbol: {
          ...s.tradesBySymbol,
          [symbol]: (s.tradesBySymbol[symbol] ?? []).map((t) => (t.id === id ? updated : t)),
        },
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  async close(symbol, id, exitPrice, reason) {
    try {
      const updated = await simulatedTradesService.close(id, exitPrice, reason);
      set((s) => ({
        tradesBySymbol: {
          ...s.tradesBySymbol,
          [symbol]: (s.tradesBySymbol[symbol] ?? []).map((t) => (t.id === id ? updated : t)),
        },
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  async remove(symbol, id) {
    try {
      await simulatedTradesService.remove(id);
      set((s) => ({
        tradesBySymbol: {
          ...s.tradesBySymbol,
          [symbol]: (s.tradesBySymbol[symbol] ?? []).filter((t) => t.id !== id),
        },
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  getOpenVisible(symbol) {
    return (get().tradesBySymbol[symbol] ?? []).filter(
      (t) => t.status === "ABIERTA" && t.visible
    );
  },
}));
