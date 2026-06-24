// Capa de servicio sobre apiClient. Encapsula la logica de negocio de datos de
// mercado (ej. cargar las seis temporalidades de un simbolo de forma tolerante
// a fallos parciales).

import { apiClient, ApiError, type OHLCVResponse, type QuoteResponse } from "./apiClient";
import { PRESET_KEYS, type PresetKey } from "@/utils/timeframes";
import type { SymbolInfo } from "@/features/symbols/symbolTypes";
import type { ChartSlotConfig } from "@/features/charts/chartWorkspaceTypes";

export interface PresetLoadResult {
  preset: PresetKey;
  data?: OHLCVResponse;
  error?: string;
}

/** Resultado de cargar UN slot de grafica (range/interval dinamicos). */
export interface SlotLoadResult {
  slotId: string;
  data?: OHLCVResponse;
  error?: string;
}

function errMessage(reason: unknown): string {
  if (reason instanceof ApiError) return reason.message;
  return (reason as Error)?.message ?? "Error desconocido";
}

// Velas de "warmup" (ocultas) que se piden ANTES del rango visible para que los
// indicadores de periodo largo se calculen completos. La EMA 200 necesita ~200
// velas solo para empezar y ~3x para estabilizarse; pedimos el maximo que admite
// el backend (clamp por limites de yfinance, sin fallar) para que EMA/VWAP salgan
// correctos en las seis graficas. Solo afecta el CALCULO; nunca se pintan como
// velas ni amplian el rango visible.
export const INDICATOR_WARMUP_BARS = 600;

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
          warmupBars: INDICATOR_WARMUP_BARS,
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

  /** OHLCV de un slot (range/interval dinamicos), con warmup para indicadores. */
  async getCandles(
    symbol: string,
    range: string,
    interval: string,
    forceRefresh = false
  ): Promise<OHLCVResponse> {
    return apiClient.getCandles(symbol, range, interval, {
      includeWarmup: true,
      warmupBars: INDICATOR_WARMUP_BARS,
      forceRefresh,
    });
  },

  /**
   * Carga los seis slots de un workspace en paralelo y tolerante a fallos
   * parciales (Promise.allSettled): un slot con range/interval no soportado o
   * sin datos no tumba a los demas. La clave del resultado es el slotId.
   */
  async loadAllSlots(
    symbol: string,
    slots: ChartSlotConfig[],
    forceRefresh = false
  ): Promise<SlotLoadResult[]> {
    const settled = await Promise.allSettled(
      slots.map((s) =>
        apiClient.getCandles(symbol, s.range, s.interval, {
          includeWarmup: true,
          warmupBars: INDICATOR_WARMUP_BARS,
          forceRefresh,
        })
      )
    );
    return settled.map((result, i) => {
      const slotId = slots[i].slotId;
      if (result.status === "fulfilled") return { slotId, data: result.value };
      return { slotId, error: errMessage(result.reason) };
    });
  },

  async search(query: string): Promise<SymbolInfo[]> {
    const res = await apiClient.searchSymbols(query);
    return res.results;
  },
};
