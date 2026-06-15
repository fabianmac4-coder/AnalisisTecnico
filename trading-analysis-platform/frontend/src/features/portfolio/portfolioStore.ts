// Estado global de Portfolio Analysis. Informativo; no es asesoría financiera.
import { create } from "zustand";
import { portfolioService } from "./portfolioService";
import type {
  Portfolio,
  PortfolioAnalysis,
  PortfolioCreate,
  PortfolioPosition,
  PositionCreate,
} from "./portfolioTypes";

interface PortfolioState {
  portfolios: Portfolio[];
  activeId: number | null;
  analysis: PortfolioAnalysis | null;
  loading: boolean;
  analysisLoading: boolean;
  error: string | null;
  // Modal de posición (alta/edición).
  positionModalOpen: boolean;
  editingPosition: PortfolioPosition | null;
  // Resumen de IA.
  aiSummary: string | null;
  aiLoading: boolean;
  aiMessage: string | null;

  loadPortfolios: () => Promise<void>;
  selectPortfolio: (c090Id: number) => Promise<void>;
  createPortfolio: (body: PortfolioCreate) => Promise<boolean>;
  updatePortfolio: (c090Id: number, body: Partial<PortfolioCreate>) => Promise<void>;
  deletePortfolio: (c090Id: number) => Promise<void>;
  setDefault: (c090Id: number) => Promise<void>;
  loadAnalysis: (forceRefresh?: boolean) => Promise<void>;
  openPositionModal: (position?: PortfolioPosition) => void;
  closePositionModal: () => void;
  savePosition: (body: PositionCreate) => Promise<boolean>;
  deletePosition: (c091Id: number) => Promise<void>;
  generateAiSummary: () => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  portfolios: [],
  activeId: null,
  analysis: null,
  loading: false,
  analysisLoading: false,
  error: null,
  positionModalOpen: false,
  editingPosition: null,
  aiSummary: null,
  aiLoading: false,
  aiMessage: null,

  async loadPortfolios() {
    set({ loading: true, error: null });
    try {
      const portfolios = await portfolioService.list();
      set({ loading: false, portfolios });
      const current = get().activeId;
      const stillExists = current && portfolios.some((p) => p.c090Id === current);
      const next = stillExists
        ? current
        : portfolios.find((p) => p.isDefault)?.c090Id ?? portfolios[0]?.c090Id ?? null;
      if (next && next !== current) {
        await get().selectPortfolio(next);
      } else if (!next) {
        set({ activeId: null, analysis: null });
      }
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  async selectPortfolio(c090Id) {
    set({ activeId: c090Id, aiSummary: null, aiMessage: null });
    await get().loadAnalysis();
  },

  async createPortfolio(body) {
    set({ error: null });
    try {
      const created = await portfolioService.create(body);
      await get().loadPortfolios();
      await get().selectPortfolio(created.c090Id);
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  async updatePortfolio(c090Id, body) {
    await portfolioService.update(c090Id, body);
    await get().loadPortfolios();
  },

  async deletePortfolio(c090Id) {
    await portfolioService.remove(c090Id);
    if (get().activeId === c090Id) set({ activeId: null, analysis: null });
    await get().loadPortfolios();
  },

  async setDefault(c090Id) {
    await portfolioService.setDefault(c090Id);
    await get().loadPortfolios();
  },

  async loadAnalysis(forceRefresh = false) {
    const id = get().activeId;
    if (!id) {
      set({ analysis: null });
      return;
    }
    set({ analysisLoading: true, error: null });
    try {
      const analysis = await portfolioService.analysis(id, forceRefresh);
      set({ analysisLoading: false, analysis });
    } catch (err) {
      set({ analysisLoading: false, error: (err as Error).message });
    }
  },

  openPositionModal(position) {
    set({ positionModalOpen: true, editingPosition: position ?? null, error: null });
  },
  closePositionModal() {
    set({ positionModalOpen: false, editingPosition: null });
  },

  async savePosition(body) {
    const id = get().activeId;
    if (!id) return false;
    set({ error: null });
    try {
      const editing = get().editingPosition;
      if (editing) {
        await portfolioService.updatePosition(editing.c091Id, body);
      } else {
        await portfolioService.addPosition(id, body);
      }
      set({ positionModalOpen: false, editingPosition: null });
      await get().loadAnalysis(true);
      return true;
    } catch (err) {
      set({ error: (err as Error).message || "No se pudo guardar la posición" });
      return false;
    }
  },

  async deletePosition(c091Id) {
    try {
      await portfolioService.deletePosition(c091Id);
      await get().loadAnalysis(true);
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  async generateAiSummary() {
    const id = get().activeId;
    if (!id) return;
    set({ aiLoading: true, aiSummary: null, aiMessage: null });
    try {
      const res = await portfolioService.aiSummary(id);
      set({
        aiLoading: false,
        aiSummary: res.available ? res.summary : null,
        aiMessage: res.available ? null : res.message ?? "Resumen de IA no disponible.",
      });
    } catch (err) {
      set({ aiLoading: false, aiMessage: (err as Error).message || "Resumen de IA no disponible." });
    }
  },
}));
