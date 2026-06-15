// Estado global de entradas simuladas (paper trading) por simbolo.
// Analisis HIPOTETICO: no ejecuta ordenes reales.

import { create } from "zustand";
import { simulatedTradesService } from "./simulatedTradesService";
import type {
  SimulatedTrade,
  SimulatedTradeCreate,
  SimulatedTradeDetail,
} from "./simulatedTradesTypes";

interface SimulatedTradesState {
  /** Entradas del WORKSPACE ACTIVO por símbolo (no se mezclan entre workspaces). */
  tradesBySymbol: Record<string, SimulatedTrade[]>;
  /** Workspace (C030Id) cuyas entradas están cargadas, por símbolo. */
  loadedWorkspaceBySymbol: Record<string, number | null | undefined>;
  loading: boolean;
  error: string | null;
  /** Abre el modal de nueva entrada (lo consume SimulatedTradeModal). */
  modalOpen: boolean;
  /** Detalle (snapshot de análisis) abierto en el modal de detalle. */
  detail: SimulatedTradeDetail | null;
  detailLoading: boolean;

  openModal: () => void;
  closeModal: () => void;
  openDetail: (id: number) => Promise<void>;
  closeDetail: () => void;
  load: (symbol: string, c030Id?: number | null) => Promise<void>;
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
  loadedWorkspaceBySymbol: {},
  loading: false,
  error: null,
  modalOpen: false,
  detail: null,
  detailLoading: false,

  openModal() {
    set({ modalOpen: true, error: null });
  },
  closeModal() {
    set({ modalOpen: false });
  },

  async openDetail(id) {
    set({ detailLoading: true, detail: null });
    try {
      const detail = await simulatedTradesService.detail(id);
      set({ detail, detailLoading: false });
    } catch (err) {
      set({ detailLoading: false, error: (err as Error).message });
    }
  },
  closeDetail() {
    set({ detail: null, detailLoading: false });
  },

  async load(symbol, c030Id) {
    set({ loading: true, error: null });
    try {
      const trades = await simulatedTradesService.list(symbol, c030Id);
      set((s) => ({
        tradesBySymbol: { ...s.tradesBySymbol, [symbol]: trades },
        loadedWorkspaceBySymbol: { ...s.loadedWorkspaceBySymbol, [symbol]: c030Id },
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
