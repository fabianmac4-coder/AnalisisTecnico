import { create } from "zustand";
import type { CatalogSymbol, SymbolInfo } from "@/features/symbols/symbolTypes";
import { marketDataService } from "@/services/marketDataService";
import type { SymbolCatalogRepository } from "@/repositories/SymbolCatalogRepository";
import { ApiSymbolCatalogRepository } from "@/repositories/ApiSymbolCatalogRepository";
import { LocalStorageSymbolCatalogRepository } from "@/repositories/LocalStorageSymbolCatalogRepository";
import { useChartStore } from "./chartStore";
import { useChartWorkspaceStore } from "@/features/charts/chartWorkspaceStore";

// Watchlist en SQL via API; localStorage solo en tests (sin red).
const catalogRepo: SymbolCatalogRepository =
  import.meta.env.MODE === "test"
    ? new LocalStorageSymbolCatalogRepository()
    : new ApiSymbolCatalogRepository();

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

interface SymbolState {
  catalog: CatalogSymbol[];
  activeSymbol: string | null;
  searching: boolean;
  searchError: string | null;

  hydrate: () => Promise<void>;
  searchSymbol: (query: string) => Promise<SymbolInfo | null>;
  selectSymbol: (symbol: string) => Promise<void>;
  pinSymbol: (symbol: string) => Promise<void>;
  removeSymbol: (symbol: string) => Promise<void>;
  /** Helper interno: inserta/actualiza el catalogo a partir de info del backend. */
  addToCatalogFromInfo: (info: SymbolInfo) => Promise<void>;
}

export const useSymbolStore = create<SymbolState>((set, get) => ({
  catalog: [],
  activeSymbol: null,
  searching: false,
  searchError: null,

  async hydrate() {
    const catalog = await catalogRepo.list();
    set({ catalog });
  },

  /**
   * Busca un ticker en el backend. Si existe, lo agrega/actualiza en el catalogo
   * y lo selecciona (cargando sus seis graficas).
   */
  async searchSymbol(query) {
    const q = query.trim().toUpperCase();
    if (!q) return null;
    set({ searching: true, searchError: null });
    try {
      const results = await marketDataService.search(q);
      const info = results[0] ?? null;
      if (!info) {
        set({ searchError: `No se encontro el ticker "${q}"` });
        return null;
      }
      await get().addToCatalogFromInfo(info);
      await get().selectSymbol(info.symbol);
      return info;
    } catch (err) {
      set({ searchError: (err as Error).message });
      return null;
    } finally {
      set({ searching: false });
    }
  },

  async selectSymbol(symbol) {
    symbol = symbol.toUpperCase();
    set({ activeSymbol: symbol });

    // Actualiza lastViewedAt si ya esta en catalogo.
    const existing = get().catalog.find((c) => c.symbol === symbol);
    if (existing) {
      const updated: CatalogSymbol = { ...existing, lastViewedAt: new Date().toISOString() };
      await catalogRepo.upsert(updated);
      set({ catalog: get().catalog.map((c) => (c.symbol === symbol ? updated : c)) });
    }

    // Marca el simbolo activo en el chartStore (el grid lo necesita para
    // renderizar) y carga los workspaces. El ChartGrid carga, de forma
    // reactiva, los seis slots Y los dibujos del workspace ACTIVO (los dibujos
    // estan aislados por workspace: ver ChartGrid).
    useChartStore.setState({ activeSymbol: symbol });
    await useChartWorkspaceStore.getState().loadWorkspaces(symbol);
  },

  async pinSymbol(symbol) {
    const existing = get().catalog.find((c) => c.symbol === symbol);
    if (!existing) return;
    const updated: CatalogSymbol = {
      ...existing,
      pinned: !existing.pinned,
      updatedAt: new Date().toISOString(),
    };
    await catalogRepo.upsert(updated);
    set({ catalog: get().catalog.map((c) => (c.symbol === symbol ? updated : c)) });
  },

  async removeSymbol(symbol) {
    await catalogRepo.remove(symbol);
    const remaining = get().catalog.filter((c) => c.symbol !== symbol);
    set({ catalog: remaining });
    if (get().activeSymbol === symbol) {
      set({ activeSymbol: null });
      useChartStore.getState().reset();
    }
  },

  // Helper interno (no expuesto en la interfaz publica del store).
  async addToCatalogFromInfo(info: SymbolInfo): Promise<void> {
    const now = new Date().toISOString();
    const existing = get().catalog.find((c) => c.symbol === info.symbol);
    if (existing) {
      const updated: CatalogSymbol = { ...existing, lastViewedAt: now, updatedAt: now };
      await catalogRepo.upsert(updated);
      set({ catalog: get().catalog.map((c) => (c.symbol === info.symbol ? updated : c)) });
      return;
    }
    const entry: CatalogSymbol = {
      id: newId(),
      symbol: info.symbol,
      name: info.name,
      exchange: info.exchange,
      currency: info.currency,
      type: info.type,
      provider: "yahoo",
      pinned: false,
      tags: [],
      lastViewedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await catalogRepo.upsert(entry);
    set({ catalog: [...get().catalog, entry] });
  },
}));
