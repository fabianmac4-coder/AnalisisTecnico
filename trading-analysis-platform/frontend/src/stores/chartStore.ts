import { create } from "zustand";
import type { ChartType } from "@/features/charting/chartEngine/ChartEngineAdapter";
import type { OHLCVResponse, QuoteResponse } from "@/services/apiClient";
import { marketDataService } from "@/services/marketDataService";
import type { LayoutRepository } from "@/repositories/LayoutRepository";
import { ApiLayoutRepository } from "@/repositories/ApiLayoutRepository";
import { LocalStorageLayoutRepository } from "@/repositories/LocalStorageLayoutRepository";
import { PRESET_KEYS, type PresetKey } from "@/utils/timeframes";

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
  chartDataByPreset: ByPreset<OHLCVResponse>;
  chartTypeByPreset: Record<PresetKey, ChartType>;
  loadingByPreset: ByPreset<boolean>;
  errorByPreset: ByPreset<string>;

  // Cotizacion canonica por simbolo (fuente unica del precio mostrado).
  quoteBySymbol: Record<string, QuoteResponse>;
  quoteLoadingBySymbol: Record<string, boolean>;
  quoteErrorBySymbol: Record<string, string>;

  loadAllPresets: (symbol: string) => Promise<void>;
  loadQuote: (symbol: string) => Promise<void>;
  setChartType: (preset: PresetKey, chartType: ChartType) => void;
  setChartTypeAll: (chartType: ChartType) => void;
  hydrateChartTypes: () => Promise<void>;
  reset: () => void;
}

export const useChartStore = create<ChartState>((set, get) => ({
  activeSymbol: null,
  chartDataByPreset: {},
  chartTypeByPreset: defaultChartTypes(),
  loadingByPreset: {},
  errorByPreset: {},
  quoteBySymbol: {},
  quoteLoadingBySymbol: {},
  quoteErrorBySymbol: {},

  async loadQuote(symbol) {
    symbol = symbol.toUpperCase();
    set({
      quoteLoadingBySymbol: { ...get().quoteLoadingBySymbol, [symbol]: true },
      quoteErrorBySymbol: { ...get().quoteErrorBySymbol, [symbol]: "" },
    });
    try {
      const quote = await marketDataService.getQuote(symbol);
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

  async loadAllPresets(symbol) {
    symbol = symbol.toUpperCase();
    // Reinicia estado y marca todo en loading.
    set({
      activeSymbol: symbol,
      chartDataByPreset: {},
      errorByPreset: {},
      loadingByPreset: PRESET_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {}),
    });

    // Carga la cotizacion canonica una vez, en paralelo con las seis presets.
    void get().loadQuote(symbol);

    const results = await marketDataService.loadAllPresets(symbol);

    // Si el usuario cambio de simbolo mientras cargabamos, ignoramos.
    if (get().activeSymbol !== symbol) return;

    const data: ByPreset<OHLCVResponse> = {};
    const errors: ByPreset<string> = {};
    const loading: ByPreset<boolean> = {};
    for (const r of results) {
      loading[r.preset] = false;
      if (r.data) data[r.preset] = r.data;
      if (r.error) errors[r.preset] = r.error;
    }
    set({ chartDataByPreset: data, errorByPreset: errors, loadingByPreset: loading });
  },

  setChartType(preset, chartType) {
    const next = { ...get().chartTypeByPreset, [preset]: chartType };
    set({ chartTypeByPreset: next });
    void layoutRepo.saveDefault({
      id: "default",
      name: "Default",
      isDefault: true,
      chartTypeByPreset: next,
      theme: "dark",
    });
  },

  setChartTypeAll(chartType) {
    const next = PRESET_KEYS.reduce(
      (acc, k) => {
        acc[k] = chartType;
        return acc;
      },
      {} as Record<PresetKey, ChartType>
    );
    set({ chartTypeByPreset: next });
    void layoutRepo.saveDefault({
      id: "default",
      name: "Default",
      isDefault: true,
      chartTypeByPreset: next,
      theme: "dark",
    });
  },

  async hydrateChartTypes() {
    const layout = await layoutRepo.getDefault();
    if (layout?.chartTypeByPreset) {
      set({ chartTypeByPreset: { ...defaultChartTypes(), ...layout.chartTypeByPreset } });
    }
  },

  reset() {
    set({ activeSymbol: null, chartDataByPreset: {}, errorByPreset: {}, loadingByPreset: {} });
  },
}));
