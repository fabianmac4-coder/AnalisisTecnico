import { create } from "zustand";
import { chartWorkspaceApi } from "./chartWorkspaceApi";
import {
  type CandleInterval,
  type ChartRange,
  type ChartWorkspace,
} from "./chartWorkspaceTypes";

// Solo el "workspace activo por simbolo" se persiste localmente; la config de
// cada workspace vive en C030 (fuente de verdad).
const ACTIVE_KEY = "tradingPlatform.activeWorkspaceBySymbol";

function loadActiveMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveActiveMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(map));
  } catch {
    /* localStorage no disponible: estado en memoria sigue valido */
  }
}

function pickActiveId(
  workspaces: ChartWorkspace[],
  preferred: number | undefined
): number | undefined {
  if (preferred && workspaces.some((w) => w.c030Id === preferred)) return preferred;
  const def = workspaces.find((w) => w.isDefault);
  return (def ?? workspaces[0])?.c030Id;
}

interface ChartWorkspaceState {
  workspacesBySymbol: Record<string, ChartWorkspace[]>;
  activeWorkspaceBySymbol: Record<string, number>;
  loading: boolean;
  saving: boolean;
  error: string | null;

  loadWorkspaces: (symbol: string) => Promise<void>;
  createWorkspace: (
    symbol: string,
    name: string,
    copyFromC030Id?: number
  ) => Promise<void>;
  renameWorkspace: (symbol: string, c030Id: number, name: string) => Promise<void>;
  duplicateWorkspace: (
    symbol: string,
    c030Id: number,
    newName: string
  ) => Promise<void>;
  deleteWorkspace: (symbol: string, c030Id: number) => Promise<void>;
  setDefaultWorkspace: (symbol: string, c030Id: number) => Promise<void>;
  setActiveWorkspace: (symbol: string, c030Id: number) => void;
  updateChartSlot: (
    symbol: string,
    c030Id: number,
    slotId: string,
    range: ChartRange,
    interval: CandleInterval
  ) => Promise<void>;
}

function upsertWorkspace(
  list: ChartWorkspace[],
  ws: ChartWorkspace
): ChartWorkspace[] {
  const idx = list.findIndex((w) => w.c030Id === ws.c030Id);
  if (idx === -1) return [...list, ws];
  const next = [...list];
  next[idx] = ws;
  return next;
}

export const useChartWorkspaceStore = create<ChartWorkspaceState>((set, get) => ({
  workspacesBySymbol: {},
  activeWorkspaceBySymbol: loadActiveMap(),
  loading: false,
  saving: false,
  error: null,

  async loadWorkspaces(symbol) {
    symbol = symbol.toUpperCase();
    set({ loading: true, error: null });
    try {
      const workspaces = await chartWorkspaceApi.list(symbol);
      const active = { ...get().activeWorkspaceBySymbol };
      const chosen = pickActiveId(workspaces, active[symbol]);
      if (chosen != null) active[symbol] = chosen;
      saveActiveMap(active);
      set({
        workspacesBySymbol: { ...get().workspacesBySymbol, [symbol]: workspaces },
        activeWorkspaceBySymbol: active,
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  async createWorkspace(symbol, name, copyFromC030Id) {
    symbol = symbol.toUpperCase();
    set({ saving: true, error: null });
    try {
      const ws = await chartWorkspaceApi.create(symbol, name, copyFromC030Id);
      const list = upsertWorkspace(get().workspacesBySymbol[symbol] ?? [], ws);
      const active = { ...get().activeWorkspaceBySymbol, [symbol]: ws.c030Id };
      saveActiveMap(active);
      set({
        workspacesBySymbol: { ...get().workspacesBySymbol, [symbol]: list },
        activeWorkspaceBySymbol: active,
        saving: false,
      });
    } catch (err) {
      set({ saving: false, error: (err as Error).message });
    }
  },

  async renameWorkspace(symbol, c030Id, name) {
    symbol = symbol.toUpperCase();
    set({ saving: true, error: null });
    try {
      const ws = await chartWorkspaceApi.rename(c030Id, name);
      const list = upsertWorkspace(get().workspacesBySymbol[symbol] ?? [], ws);
      set({
        workspacesBySymbol: { ...get().workspacesBySymbol, [symbol]: list },
        saving: false,
      });
    } catch (err) {
      set({ saving: false, error: (err as Error).message });
    }
  },

  async duplicateWorkspace(symbol, c030Id, newName) {
    await get().createWorkspace(symbol, newName, c030Id);
  },

  async deleteWorkspace(symbol, c030Id) {
    symbol = symbol.toUpperCase();
    set({ saving: true, error: null });
    try {
      await chartWorkspaceApi.remove(c030Id);
      // Recarga para reflejar reasignacion de default en el backend.
      const workspaces = await chartWorkspaceApi.list(symbol);
      const active = { ...get().activeWorkspaceBySymbol };
      active[symbol] = pickActiveId(workspaces, undefined) ?? active[symbol];
      saveActiveMap(active);
      set({
        workspacesBySymbol: { ...get().workspacesBySymbol, [symbol]: workspaces },
        activeWorkspaceBySymbol: active,
        saving: false,
      });
    } catch (err) {
      set({ saving: false, error: (err as Error).message });
    }
  },

  async setDefaultWorkspace(symbol, c030Id) {
    symbol = symbol.toUpperCase();
    set({ saving: true, error: null });
    try {
      await chartWorkspaceApi.setDefault(c030Id);
      const list = (get().workspacesBySymbol[symbol] ?? []).map((w) => ({
        ...w,
        isDefault: w.c030Id === c030Id,
      }));
      set({
        workspacesBySymbol: { ...get().workspacesBySymbol, [symbol]: list },
        saving: false,
      });
    } catch (err) {
      set({ saving: false, error: (err as Error).message });
    }
  },

  setActiveWorkspace(symbol, c030Id) {
    symbol = symbol.toUpperCase();
    const active = { ...get().activeWorkspaceBySymbol, [symbol]: c030Id };
    saveActiveMap(active);
    set({ activeWorkspaceBySymbol: active });
  },

  async updateChartSlot(symbol, c030Id, slotId, range, interval) {
    symbol = symbol.toUpperCase();
    set({ saving: true, error: null });
    try {
      const ws = await chartWorkspaceApi.updateChartSlots(c030Id, [
        { slotId, range, interval },
      ]);
      const list = upsertWorkspace(get().workspacesBySymbol[symbol] ?? [], ws);
      set({
        workspacesBySymbol: { ...get().workspacesBySymbol, [symbol]: list },
        saving: false,
      });
    } catch (err) {
      set({ saving: false, error: (err as Error).message });
    }
  },
}));

/** Selector: workspace activo del simbolo (o undefined). */
export function selectActiveWorkspace(
  state: ChartWorkspaceState,
  symbol: string | null
): ChartWorkspace | undefined {
  if (!symbol) return undefined;
  const up = symbol.toUpperCase();
  const list = state.workspacesBySymbol[up];
  if (!list || list.length === 0) return undefined;
  const activeId = state.activeWorkspaceBySymbol[up];
  return list.find((w) => w.c030Id === activeId) ?? list.find((w) => w.isDefault) ?? list[0];
}
