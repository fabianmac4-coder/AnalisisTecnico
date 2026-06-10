// Definicion centralizada de las seis temporalidades obligatorias.
// El backend tiene un archivo equivalente (app/timeframes.py): ambos deben
// permanecer alineados (misma key, mismo interval).

export type PresetKey = "4Y_1W" | "1Y_1D" | "6M_1D" | "3M_1D" | "1M_1H" | "1W_30M";

export interface TimeframePreset {
  key: PresetKey;
  label: string;
  /** period de yfinance, cuando aplica (ej. "1y"). */
  period?: string;
  interval: string;
  /** Etiqueta corta para mostrar en la grafica (ej. "1D", "60", "30"). */
  chartIntervalLabel: string;
  intraday: boolean;
}

export const TIMEFRAME_PRESETS: TimeframePreset[] = [
  {
    key: "4Y_1W",
    label: "4 años / Semanal",
    interval: "1wk",
    chartIntervalLabel: "1W",
    intraday: false,
  },
  {
    key: "1Y_1D",
    label: "1 año / Diario",
    period: "1y",
    interval: "1d",
    chartIntervalLabel: "1D",
    intraday: false,
  },
  {
    key: "6M_1D",
    label: "6 meses / Diario",
    period: "6mo",
    interval: "1d",
    chartIntervalLabel: "1D",
    intraday: false,
  },
  {
    key: "3M_1D",
    label: "3 meses / Diario",
    period: "3mo",
    interval: "1d",
    chartIntervalLabel: "1D",
    intraday: false,
  },
  {
    key: "1M_1H",
    label: "1 mes / 1 hora",
    period: "1mo",
    interval: "1h",
    chartIntervalLabel: "60",
    intraday: true,
  },
  {
    key: "1W_30M",
    label: "1 semana / 30 minutos",
    interval: "30m",
    chartIntervalLabel: "30",
    intraday: true,
  },
];

export const PRESET_KEYS: PresetKey[] = TIMEFRAME_PRESETS.map((p) => p.key);

const BY_KEY: Record<PresetKey, TimeframePreset> = TIMEFRAME_PRESETS.reduce(
  (acc, p) => {
    acc[p.key] = p;
    return acc;
  },
  {} as Record<PresetKey, TimeframePreset>
);

export function getPreset(key: PresetKey): TimeframePreset {
  return BY_KEY[key];
}

export function isIntraday(key: PresetKey): boolean {
  return BY_KEY[key].intraday;
}
