// Resuelve el "precio actual" canonico a mostrar en la UI.
// Fuente primaria: la cotizacion (quote.price). Si no esta disponible, cae al
// ultimo close de la preset de MAYOR resolucion disponible, en este orden.
// Funcion pura -> testeable.

import type { OHLCVResponse, QuoteResponse } from "@/services/apiClient";
import type { PresetKey } from "@/utils/timeframes";

// Orden de preferencia para el fallback (mayor resolucion primero).
export const PRICE_FALLBACK_ORDER: PresetKey[] = [
  "1W_30M",
  "1M_1H",
  "3M_1D",
  "6M_1D",
  "1Y_1D",
  "4Y_1W",
];

export interface ResolvedPrice {
  price: number | null;
  /** De donde salio el precio: la cotizacion o una preset de respaldo. */
  source: "quote" | PresetKey | "none";
}

export function resolveDisplayPrice(
  quote: QuoteResponse | undefined,
  chartDataByPreset: Partial<Record<PresetKey, OHLCVResponse>>
): ResolvedPrice {
  if (quote && typeof quote.price === "number" && !Number.isNaN(quote.price)) {
    return { price: quote.price, source: "quote" };
  }

  for (const preset of PRICE_FALLBACK_ORDER) {
    const bars = chartDataByPreset[preset]?.bars;
    if (bars && bars.length > 0) {
      return { price: bars[bars.length - 1].close, source: preset };
    }
  }

  return { price: null, source: "none" };
}

/**
 * Variante para workspaces: el precio canonico sale de la cotizacion; si falta,
 * usa el ultimo close del slot de MAYOR resolucion disponible (menor intervalo).
 * `slotData` es la lista de respuestas OHLCV de los slots del workspace activo.
 */
const INTERVAL_RESOLUTION_ORDER = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "1d",
  "1wk",
  "1mo",
];

export function resolveDisplayPriceFromSlots(
  quote: QuoteResponse | undefined,
  slotData: OHLCVResponse[]
): number | null {
  if (quote && typeof quote.price === "number" && !Number.isNaN(quote.price)) {
    return quote.price;
  }
  const withBars = slotData.filter((d) => d.bars && d.bars.length > 0);
  withBars.sort(
    (a, b) =>
      INTERVAL_RESOLUTION_ORDER.indexOf(a.interval) -
      INTERVAL_RESOLUTION_ORDER.indexOf(b.interval)
  );
  const best = withBars[0];
  return best ? best.bars[best.bars.length - 1].close : null;
}
