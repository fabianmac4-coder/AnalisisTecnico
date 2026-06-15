import { create } from "zustand";
import { stockScorecardService } from "./stockScorecardService";
import type { StockScorecardResponse } from "./stockScorecardTypes";

interface StockScorecardState {
  bySymbol: Record<string, StockScorecardResponse>;
  loadingBySymbol: Record<string, boolean>;
  errorBySymbol: Record<string, string>;
  /** Expandido (ver detalles) por símbolo. */
  expandedBySymbol: Record<string, boolean>;

  load: (symbol: string, forceRefresh?: boolean) => Promise<void>;
  toggleExpanded: (symbol: string) => void;
}

export const useStockScorecardStore = create<StockScorecardState>((set, get) => ({
  bySymbol: {},
  loadingBySymbol: {},
  errorBySymbol: {},
  expandedBySymbol: {},

  async load(symbol, forceRefresh = false) {
    symbol = symbol.toUpperCase();
    set({
      loadingBySymbol: { ...get().loadingBySymbol, [symbol]: true },
      errorBySymbol: { ...get().errorBySymbol, [symbol]: "" },
    });
    try {
      const data = await stockScorecardService.get(symbol, { forceRefresh });
      set({
        bySymbol: { ...get().bySymbol, [symbol]: data },
        loadingBySymbol: { ...get().loadingBySymbol, [symbol]: false },
      });
    } catch (err) {
      set({
        errorBySymbol: { ...get().errorBySymbol, [symbol]: (err as Error).message },
        loadingBySymbol: { ...get().loadingBySymbol, [symbol]: false },
      });
    }
  },

  toggleExpanded(symbol) {
    symbol = symbol.toUpperCase();
    set({
      expandedBySymbol: {
        ...get().expandedBySymbol,
        [symbol]: !get().expandedBySymbol[symbol],
      },
    });
  },
}));

/** Selector: scorecard del símbolo (o undefined). */
export function selectScorecard(
  state: StockScorecardState,
  symbol: string | null
): StockScorecardResponse | undefined {
  if (!symbol) return undefined;
  return state.bySymbol[symbol.toUpperCase()];
}
