import { create } from "zustand";
import type { Drawing, DrawingTool } from "@/features/drawings/drawingTypes";
import type { DrawingRepository } from "@/repositories/DrawingRepository";
import { ApiDrawingRepository } from "@/repositories/ApiDrawingRepository";
import { LocalStorageDrawingRepository } from "@/repositories/LocalStorageDrawingRepository";

// Persistencia primaria: SQL via API (requiere sesion). En tests (vitest) se
// usa localStorage para poder probar la logica sin red.
const drawingRepo: DrawingRepository =
  import.meta.env.MODE === "test"
    ? new LocalStorageDrawingRepository()
    : new ApiDrawingRepository();

interface DrawingState {
  /** Dibujos del WORKSPACE ACTIVO por símbolo (no se mezclan entre workspaces). */
  drawingsBySymbol: Record<string, Drawing[]>;
  /** Workspace (C030Id) cuyos dibujos están cargados, por símbolo. */
  loadedWorkspaceBySymbol: Record<string, number | undefined>;
  activeTool: DrawingTool;
  selectedDrawingId: string | null;

  loadDrawings: (symbol: string, c030Id?: number) => Promise<void>;
  addDrawing: (drawing: Drawing) => Promise<Drawing>;
  updateDrawing: (drawing: Drawing) => Promise<void>;
  removeDrawing: (id: string) => Promise<void>;
  clearForSymbol: (symbol: string) => Promise<void>;
  deleteByTimeframe: (symbol: string, sourceTimeframe: string) => Promise<void>;
  setActiveTool: (tool: DrawingTool) => void;
  selectDrawing: (id: string | null) => void;
  getDrawings: (symbol: string) => Drawing[];
}

export const useDrawingStore = create<DrawingState>((set, get) => ({
  drawingsBySymbol: {},
  loadedWorkspaceBySymbol: {},
  activeTool: "cursor",
  selectedDrawingId: null,

  async loadDrawings(symbol, c030Id) {
    symbol = symbol.toUpperCase();
    const list = await drawingRepo.listBySymbol(symbol, c030Id);
    set({
      drawingsBySymbol: { ...get().drawingsBySymbol, [symbol]: list },
      loadedWorkspaceBySymbol: { ...get().loadedWorkspaceBySymbol, [symbol]: c030Id },
      selectedDrawingId: null,
    });
  },

  async addDrawing(drawing) {
    const saved = await drawingRepo.upsert(drawing);
    const list = get().drawingsBySymbol[saved.symbol] ?? [];
    set({
      drawingsBySymbol: { ...get().drawingsBySymbol, [saved.symbol]: [...list, saved] },
    });
    return saved;
  },

  async updateDrawing(drawing) {
    const saved = await drawingRepo.upsert(drawing);
    const list = get().drawingsBySymbol[saved.symbol] ?? [];
    set({
      drawingsBySymbol: {
        ...get().drawingsBySymbol,
        [saved.symbol]: list.map((d) => (d.id === saved.id ? saved : d)),
      },
    });
  },

  async removeDrawing(id) {
    await drawingRepo.remove(id);
    const map = get().drawingsBySymbol;
    const next: Record<string, Drawing[]> = {};
    for (const sym of Object.keys(map)) {
      next[sym] = map[sym].filter((d) => d.id !== id);
    }
    set({ drawingsBySymbol: next, selectedDrawingId: null });
  },

  async clearForSymbol(symbol) {
    symbol = symbol.toUpperCase();
    const list = get().drawingsBySymbol[symbol] ?? [];
    await Promise.all(list.map((d) => drawingRepo.remove(d.id)));
    set({
      drawingsBySymbol: { ...get().drawingsBySymbol, [symbol]: [] },
      selectedDrawingId: null,
    });
  },

  async deleteByTimeframe(symbol, sourceTimeframe) {
    symbol = symbol.toUpperCase();
    const list = get().drawingsBySymbol[symbol] ?? [];
    const toRemove = list.filter((d) => d.sourceTimeframe === sourceTimeframe);
    await Promise.all(toRemove.map((d) => drawingRepo.remove(d.id)));
    set({
      drawingsBySymbol: {
        ...get().drawingsBySymbol,
        [symbol]: list.filter((d) => d.sourceTimeframe !== sourceTimeframe),
      },
      selectedDrawingId: null,
    });
  },

  setActiveTool(tool) {
    set({ activeTool: tool, selectedDrawingId: null });
  },

  selectDrawing(id) {
    set({ selectedDrawingId: id });
  },

  getDrawings(symbol) {
    return get().drawingsBySymbol[symbol.toUpperCase()] ?? [];
  },
}));
