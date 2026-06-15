// Mapea la `key` de la métrica del backend a la clave de ayuda del diccionario
// STOCK_SCORECARD_HELP cuando difieren (p. ej. backend "sma20" -> "priceVsSma20").
import { STOCK_SCORECARD_HELP } from "./stockScorecardHelp";

const METRIC_KEY_TO_HELP: Record<string, string> = {
  sma20: "priceVsSma20",
  sma50: "priceVsSma50",
  sma200: "priceVsSma200",
  bollinger: "bollingerPosition",
  priceToSales: "priceSales",
  priceToBook: "priceBook",
  freeCashFlow: "freeCashflow",
  freeCashflow: "freeCashflow",
};

/** Devuelve la clave de ayuda para una métrica, o undefined si no hay ayuda. */
export function metricHelpKey(metricKey: string): string | undefined {
  const mapped = METRIC_KEY_TO_HELP[metricKey] ?? metricKey;
  return STOCK_SCORECARD_HELP[mapped] ? mapped : undefined;
}
