// Tipos y presets del selector de zona horaria de las gráficas (tipo TradingView).
// IMPORTANTE: solo cambia el FORMATO de las etiquetas; los timestamps de las
// velas SIEMPRE son UTC ms y NUNCA se mutan.

export type ChartTimezoneMode =
  | "EXCHANGE"
  | "LOCAL"
  | "UTC"
  | "FIXED_OFFSET"
  | "IANA";

export interface ChartTimezoneSetting {
  mode: ChartTimezoneMode;
  /** Para FIXED_OFFSET: "-06:00"; para IANA: "America/Mexico_City". */
  value?: string;
}

export const DEFAULT_TIMEZONE_SETTING: ChartTimezoneSetting = { mode: "EXCHANGE" };

export const LS_TIMEZONE_MODE = "tradingPlatform.chartTimezoneMode";
export const LS_TIMEZONE_VALUE = "tradingPlatform.chartTimezoneValue";

/** Offsets UTC fijos (-12 .. +14), valor en formato "±HH:MM". */
export const FIXED_OFFSETS: { value: string; label: string }[] = Array.from(
  { length: 27 },
  (_, i) => {
    const off = i - 12; // -12 .. +14
    const sign = off >= 0 ? "+" : "-";
    const abs = Math.abs(off);
    const hh = String(abs).padStart(2, "0");
    return { value: `${sign}${hh}:00`, label: `UTC${off >= 0 ? "+" : "-"}${abs}` };
  }
);

/** Presets IANA útiles. */
export const IANA_PRESETS: { value: string; label: string }[] = [
  { value: "America/New_York", label: "New York" },
  { value: "America/Chicago", label: "Chicago" },
  { value: "America/Denver", label: "Denver" },
  { value: "America/Los_Angeles", label: "Los Angeles" },
  { value: "America/Mexico_City", label: "Ciudad de México" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
];
