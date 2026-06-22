// Tipos y constantes de los workspaces de analisis y los slots de grafica.
//
// Un *workspace* es una fila de C030 por usuario + accion. Contiene seis slots
// de grafica configurables; cada slot elige `range` (periodo visible) e
// `interval` (temporalidad de la vela) de forma independiente.
//
// El `contextKey` de un slot es `${range}_${interval}` (ej. "1Y_1h"). Ese
// contextKey es la "temporalidad de origen" que usan dibujos y Channel R/R
// (C0101.TemporalidadOrigen), de modo que dos slots con el mismo range/interval
// comparten dibujos aunque vivan en workspaces distintos.
//
// Equivalente backend: `app/chart_workspaces.py`. Mantener las MISMAS claves.

import type { PresetKey } from "@/utils/timeframes";
import {
  availableIntervalsForRange,
  coerceIntervalForRange,
  isSupportedRangeInterval,
} from "./chartRangeIntervalConfig";

export type ChartRange = "5Y" | "1Y" | "6M" | "3M" | "1M" | "1W" | "1D";

export type CandleInterval =
  | "1mo"
  | "1wk"
  | "1d"
  | "1h"
  | "30m"
  | "15m"
  | "5m"
  | "1m";

export type ChartSlotConfig = {
  slotId: string;
  range: ChartRange;
  interval: CandleInterval;
  label?: string;
};

export type ChartWorkspace = {
  c030Id: number;
  name: string;
  symbol: string;
  c010Id: number;
  isDefault: boolean;
  chartSlots: ChartSlotConfig[];
  configuration: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export const CHART_RANGES: ChartRange[] = ["5Y", "1Y", "6M", "3M", "1M", "1W", "1D"];

export const CANDLE_INTERVALS: CandleInterval[] = [
  "1mo",
  "1wk",
  "1d",
  "1h",
  "30m",
  "15m",
  "5m",
  "1m",
];

/** Etiqueta corta para mostrar en la cabecera de cada grafica. */
export const RANGE_LABEL: Record<ChartRange, string> = {
  "5Y": "5 años",
  "1Y": "1 año",
  "6M": "6 meses",
  "3M": "3 meses",
  "1M": "1 mes",
  "1W": "1 semana",
  "1D": "1 día",
};

export const INTERVAL_LABEL: Record<CandleInterval, string> = {
  "1mo": "Mensual",
  "1wk": "Semanal",
  "1d": "Diario",
  "1h": "1 hora",
  "30m": "30 min",
  "15m": "15 min",
  "5m": "5 min",
  "1m": "1 min",
};

/** Configuracion por defecto de los seis slots (igual que el backend). */
export const DEFAULT_CHART_SLOTS: ChartSlotConfig[] = [
  { slotId: "chart_1", range: "5Y", interval: "1wk" },
  { slotId: "chart_2", range: "1Y", interval: "1d" },
  { slotId: "chart_3", range: "6M", interval: "1d" },
  { slotId: "chart_4", range: "3M", interval: "1d" },
  { slotId: "chart_5", range: "1M", interval: "1h" },
  { slotId: "chart_6", range: "1W", interval: "30m" },
];

// IDs de las seis gráficas (slots) de un workspace. Se usan como "gráfica de
// origen" en los controles de gestión de dibujos (mostrar/ocultar/borrar).
export const ORIGIN_SLOT_IDS: readonly string[] = DEFAULT_CHART_SLOTS.map((s) => s.slotId);

export const DEFAULT_WORKSPACE_NAME = "Default Analysis";

/** contextKey de un slot: identifica la temporalidad para dibujos/Channel R/R. */
export function contextKey(range: ChartRange, interval: CandleInterval): string {
  return `${range}_${interval}`;
}

// Los seis combos por defecto se identifican con las claves de preset HISTORICAS
// (4Y_1W, 1Y_1D, ...). Asi los dibujos/canales/colores ya guardados siguen
// vinculados sin migracion. Cualquier OTRA combinacion usa su contextKey nuevo.
const DEFAULT_COMBO_TO_PRESET: Record<string, PresetKey> = {
  "5Y_1wk": "4Y_1W",
  "1Y_1d": "1Y_1D",
  "6M_1d": "6M_1D",
  "3M_1d": "3M_1D",
  "1M_1h": "1M_1H",
  "1W_30m": "1W_30M",
};

/**
 * Clave de "temporalidad de origen" de un slot (la que llevan los dibujos y usa
 * Channel R/R). Para los seis combos por defecto devuelve la preset historica;
 * para combos personalizados, el contextKey `${range}_${interval}`.
 */
export function slotTimeframeKey(
  range: ChartRange,
  interval: CandleInterval
): string {
  return DEFAULT_COMBO_TO_PRESET[contextKey(range, interval)] ?? contextKey(range, interval);
}

/** contextKey puro del slot (`${range}_${interval}`), util para deduplicar. */
export function slotContextKey(slot: ChartSlotConfig): string {
  return contextKey(slot.range, slot.interval);
}

/** Clave de temporalidad de origen del slot (dibujos/Channel R/R). */
export function slotSourceTimeframe(slot: ChartSlotConfig): string {
  return slotTimeframeKey(slot.range, slot.interval);
}

/** True si un intervalo es intradiario (afecta formato de eje de tiempo). */
export function isIntradayInterval(interval: CandleInterval): boolean {
  return ["1h", "30m", "15m", "5m", "1m"].includes(interval);
}

/** True si la combinacion range/interval esta soportada (tabla unica). */
export function isSupportedCombo(
  range: ChartRange,
  interval: CandleInterval
): boolean {
  return isSupportedRangeInterval(range, interval);
}

/** Intervalos disponibles para un rango (lo que muestra el dropdown). */
export function supportedIntervalsForRange(range: ChartRange): CandleInterval[] {
  return availableIntervalsForRange(range);
}

/**
 * Devuelve exactamente seis slots, completando/saneando los que falten.
 * Repara combinaciones range/interval invalidas (guardadas por versiones
 * previas) al intervalo por defecto del rango — nunca deja un combo invalido.
 */
export function normalizeChartSlots(
  slots: ChartSlotConfig[] | undefined | null
): ChartSlotConfig[] {
  const input = slots ?? [];
  return DEFAULT_CHART_SLOTS.map((def, i) => {
    const raw = input[i];
    const range = raw && CHART_RANGES.includes(raw.range) ? raw.range : def.range;
    const rawInterval =
      raw && CANDLE_INTERVALS.includes(raw.interval) ? raw.interval : def.interval;
    // Si el intervalo no aplica al rango, repara al default del rango.
    const interval = coerceIntervalForRange(range, rawInterval);
    const slot: ChartSlotConfig = {
      slotId: raw?.slotId || def.slotId,
      range,
      interval,
    };
    if (raw?.label) slot.label = raw.label;
    return slot;
  });
}
