import { create } from "zustand";
import type { ChartType } from "@/features/charting/chartEngine/ChartEngineAdapter";
import type { OHLCVResponse, QuoteResponse } from "@/services/apiClient";
import { marketDataService } from "@/services/marketDataService";
import type { LayoutRepository } from "@/repositories/LayoutRepository";
import { ApiLayoutRepository } from "@/repositories/ApiLayoutRepository";
import { LocalStorageLayoutRepository } from "@/repositories/LocalStorageLayoutRepository";
import { PRESET_KEYS, type PresetKey } from "@/utils/timeframes";
import type { ChartSlotConfig } from "@/features/charts/chartWorkspaceTypes";

// Layout default en SQL via API; localStorage solo en tests (sin red).
const layoutRepo: LayoutRepository =
  import.meta.env.MODE === "test"
    ? new LocalStorageLayoutRepository()
    : new ApiLayoutRepository();

type ByPreset<T> = Partial<Record<PresetKey, T>>;

function defaultChartTypes(): Record<PresetKey, ChartType> {
  return PRESET_KEYS.reduce(
    (acc, k) => {
      acc[k] = "candlestick";
      return acc;
    },
    {} as Record<PresetKey, ChartType>
  );
}

interface ChartState {
  activeSymbol: string | null;

  // --- Datos por SLOT (workspaces de analisis): clave = slotId ---
  chartDataBySlot: Record<string, OHLCVResponse>;
  loadingBySlot: Record<string, boolean>;
  errorBySlot: Record<string, string>;
  /** Slots actualmente mostrados (del workspace activo) para refrescos. */
  currentSlots: ChartSlotConfig[];
  /** Tipo de grafica por slotId (preferencia de UI, persistida globalmente). */
  chartTypeBySlot: Record<string, ChartType>;

  // --- Legacy por PRESET (compatibilidad: refresh feature, fallback) ---
  chartDataByPreset: ByPreset<OHLCVResponse>;
  chartTypeByPreset: Record<PresetKey, ChartType>;
  loadingByPreset: ByPreset<boolean>;
  errorByPreset: ByPreset<string>;

  // Cotizacion canonica por simbolo (fuente unica del precio mostrado).
  quoteBySymbol: Record<string, QuoteResponse>;
  quoteLoadingBySymbol: Record<string, boolean>;
  quoteErrorBySymbol: Record<string, string>;

  // Carga de slots del workspace activo.
  loadWorkspaceSlots: (symbol: string, slots: ChartSlotConfig[]) => Promise<void>;
  reloadSlot: (symbol: string, slot: ChartSlotConfig) => Promise<void>;
  /**
   * Recarga NO destructiva (boton/auto-refresh): refresca los slots del
   * workspace activo. Conserva los datos visibles mientras carga y mantiene los
   * viejos si un slot falla. Devuelve true si algo se actualizo.
   */
  refreshAllPresets: (symbol: string) => Promise<boolean>;
  loadQuote: (symbol: string, forceRefresh?: boolean) => Promise<void>;
  setSlotChartType: (slotId: string, chartType: ChartType) => void;
  setChartTypeAll: (chartType: ChartType) => void;
  hydrateChartTypes: () => Promise<void>;
  reset: () => void;
}

export const useChartStore = create<ChartState>((set, get) => ({
  activeSymbol: null,
  chartDataBySlot: {},
  loadingBySlot: {},
  errorBySlot: {},
  currentSlots: [],
  chartTypeBySlot: {},
  chartDataByPreset: {},
  chartTypeByPreset: defaultChartTypes(),
  loadingByPreset: {},
  errorByPreset: {},
  quoteBySymbol: {},
  quoteLoadingBySymbol: {},
  quoteErrorBySymbol: {},

  async loadQuote(symbol, forceRefresh = false) {
    symbol = symbol.toUpperCase();
    set({
      quoteLoadingBySymbol: { ...get().quoteLoadingBySymbol, [symbol]: true },
      quoteErrorBySymbol: { ...get().quoteErrorBySymbol, [symbol]: "" },
    });
    try {
      const quote = await marketDataService.getQuote(symbol, forceRefresh);
      set({
        quoteBySymbol: { ...get().quoteBySymbol, [symbol]: quote },
        quoteLoadingBySymbol: { ...get().quoteLoadingBySymbol, [symbol]: false },
      });
    } catch (err) {
      // El precio caera al fallback por-bar; no es fatal.
      set({
        quoteErrorBySymbol: {
          ...get().quoteErrorBySymbol,
          [symbol]: (err as Error).message,
        },
        quoteLoadingBySymbol: { ...get().quoteLoadingBySymbol, [symbol]: false },
      });
    }
  },

  async loadWorkspaceSlots(symbol, slots) {
    symbol = symbol.toUpperCase();
    set({
      activeSymbol: symbol,
      currentSlots: slots,
      errorBySlot: {},
      loadingBySlot: slots.reduce((acc, s) => ({ ...acc, [s.slotId]: true }), {}),
    });

    // Cotizacion canonica una vez, en paralelo con los slots.
    void get().loadQuote(symbol);

    const results = await marketDataService.loadAllSlots(symbol, slots);

    // Si el usuario cambio de simbolo mientras cargabamos, ignoramos.
    if (get().activeSymbol !== symbol) return;

    const data: Record<string, OHLCVResponse> = {};
    const errors: Record<string, string> = {};
    const loading: Record<string, boolean> = {};
    for (const r of results) {
      loading[r.slotId] = false;
      if (r.data) data[r.slotId] = r.data;
      if (r.error) errors[r.slotId] = r.error;
    }
    set({ chartDataBySlot: data, errorBySlot: errors, loadingBySlot: loading });
  },

  async reloadSlot(symbol, slot) {
    symbol = symbol.toUpperCase();
    // Mantiene currentSlots al dia para que el refresh manual use el nuevo
    // range/interval de este slot (los demas slots se conservan intactos).
    set({
      currentSlots: get().currentSlots.map((s) =>
        s.slotId === slot.slotId ? slot : s
      ),
      loadingBySlot: { ...get().loadingBySlot, [slot.slotId]: true },
      errorBySlot: { ...get().errorBySlot, [slot.slotId]: "" },
    });
    try {
      const data = await marketDataService.getCandles(symbol, slot.range, slot.interval);
      if (get().activeSymbol !== symbol) return;
      set({
        chartDataBySlot: { ...get().chartDataBySlot, [slot.slotId]: data },
        loadingBySlot: { ...get().loadingBySlot, [slot.slotId]: false },
      });
    } catch (err) {
      set({
        errorBySlot: { ...get().errorBySlot, [slot.slotId]: (err as Error).message },
        loadingBySlot: { ...get().loadingBySlot, [slot.slotId]: false },
      });
    }
  },

  async refreshAllPresets(symbol) {
    symbol = symbol.toUpperCase();
    await get().loadQuote(symbol, true);
    const quoteOk = !get().quoteErrorBySymbol[symbol];

    const slots = get().currentSlots;
    if (slots.length === 0) return quoteOk;

    const results = await marketDataService.loadAllSlots(symbol, slots, true);
    if (get().activeSymbol !== symbol) return false;

    const data = { ...get().chartDataBySlot };
    const errors: Record<string, string> = {};
    let updated = 0;
    for (const r of results) {
      if (r.data) {
        data[r.slotId] = r.data; // reemplaza solo lo que llego bien
        updated += 1;
      } else if (r.error) {
        errors[r.slotId] = r.error; // conserva las velas viejas del slot
      }
    }
    set({ chartDataBySlot: data, errorBySlot: errors });
    return updated > 0 || quoteOk;
  },

  setSlotChartType(slotId, chartType) {
    const next = { ...get().chartTypeBySlot, [slotId]: chartType };
    set({ chartTypeBySlot: next });
    void persistChartTypes(next);
  },

  setChartTypeAll(chartType) {
    const next: Record<string, ChartType> = {};
    for (const s of get().currentSlots) next[s.slotId] = chartType;
    set({ chartTypeBySlot: next });
    void persistChartTypes(next);
  },

  async hydrateChartTypes() {
    const layout = await layoutRepo.getDefault();
    if (layout?.chartTypeBySlot) set({ chartTypeBySlot: { ...layout.chartTypeBySlot } });
  },

  reset() {
    set({
      activeSymbol: null,
      chartDataBySlot: {},
      errorBySlot: {},
      loadingBySlot: {},
      currentSlots: [],
    });
  },
}));

function persistChartTypes(chartTypeBySlot: Record<string, ChartType>): Promise<void> {
  return layoutRepo.saveDefault({
    id: "default",
    name: "Default",
    isDefault: true,
    chartTypeByPreset: {},
    chartTypeBySlot,
    theme: "dark",
  });
}
