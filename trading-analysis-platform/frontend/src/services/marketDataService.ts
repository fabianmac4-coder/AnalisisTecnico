// Capa de servicio sobre apiClient. Encapsula la logica de negocio de datos de
// mercado (ej. cargar las seis temporalidades de un simbolo de forma tolerante
// a fallos parciales).

import { apiClient, ApiError, type OHLCVResponse, type QuoteResponse } from "./apiClient";
import { PRESET_KEYS, type PresetKey } from "@/utils/timeframes";
import type { SymbolInfo } from "@/features/symbols/symbolTypes";

export interface PresetLoadResult {
  preset: PresetKey;
  data?: OHLCVResponse;
  error?: string;
}

export const marketDataService = {
  async getPreset(symbol: string, preset: PresetKey): Promise<OHLCVResponse> {
    return apiClient.getOHLCV(symbol, preset);
  },

  /** Cotizacion canonica (precio actual) del simbolo. */
  async getQuote(symbol: string, forceRefresh = false): Promise<QuoteResponse> {
    return apiClient.getQuote(symbol, { forceRefresh });
  },

  /**
   * Carga las seis temporalidades en paralelo. Si una falla, las demas siguen
   * (Promise.allSettled): se cumple el criterio de "fallo parcial".
   * Pide warmup (velas previas ocultas) para que indicadores como SMA 200
   * salgan completos en cada temporalidad.
   * forceRefresh ignora el cache del backend (boton/auto-refresh).
   */
  async loadAllPresets(symbol: string, forceRefresh = false): Promise<PresetLoadResult[]> {
    const settled = await Promise.allSettled(
      PRESET_KEYS.map((preset) =>
        apiClient.getOHLCV(symbol, preset, {
          includeWarmup: true,
          warmupBars: 260,
          forceRefresh,
        })
      )
    );
    return settled.map((result, i) => {
      const preset = PRESET_KEYS[i];
      if (result.status === "fulfilled") {
        return { preset, data: result.value };
      }
      const reason = result.reason;
      const message =
        reason instanceof ApiError ? reason.message : (reason as Error)?.message ?? "Error desconocido";
      return { preset, error: message };
    });
  },

  async search(query: string): Promise<SymbolInfo[]> {
    const res = await apiClient.searchSymbols(query);
    return res.results;
  },
};
