// Formateo de etiquetas de tiempo de la gráfica según la zona horaria elegida.
// REGLA: nunca se mutan los timestamps de las velas; solo el formato visible.
import {
  DEFAULT_TIMEZONE_SETTING,
  FIXED_OFFSETS,
  IANA_PRESETS,
  LS_TIMEZONE_MODE,
  LS_TIMEZONE_VALUE,
  type ChartTimezoneMode,
  type ChartTimezoneSetting,
} from "./chartTimezoneTypes";

export type TimestampUnit = "seconds" | "milliseconds";

function toMs(timestamp: number | string, unit: TimestampUnit): number {
  if (typeof timestamp === "string") {
    // ISO o "YYYY-MM-DD" (BusinessDay de LWC): tratar como medianoche UTC.
    const t = timestamp.length <= 10 ? `${timestamp}T00:00:00Z` : timestamp;
    return new Date(t).getTime();
  }
  return unit === "seconds" ? timestamp * 1000 : timestamp;
}

/** Minutos de offset desde un valor "±HH:MM" (ej. "-06:00" -> -360). */
function offsetMinutes(value: string | undefined): number {
  if (!value) return 0;
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

export interface FormatChartTimeArgs {
  timestamp: number | string;
  timestampUnit?: TimestampUnit;
  setting: ChartTimezoneSetting;
  exchangeTimezone?: string | null;
  includeDate?: boolean;
  includeTime?: boolean;
}

/**
 * Formatea un timestamp para mostrarlo en la gráfica según la zona horaria.
 * Para FIXED_OFFSET se desplaza el instante (solo display) y se formatea en UTC.
 */
export function formatChartTime(args: FormatChartTimeArgs): string {
  const {
    timestamp,
    timestampUnit = "milliseconds",
    setting,
    exchangeTimezone,
    includeDate = true,
    includeTime = true,
  } = args;
  const ms = toMs(timestamp, timestampUnit);
  if (!Number.isFinite(ms)) return "";

  const opts: Intl.DateTimeFormatOptions = {};
  if (includeDate) {
    opts.year = "numeric";
    opts.month = "short";
    opts.day = "numeric";
  }
  if (includeTime) {
    opts.hour = "2-digit";
    opts.minute = "2-digit";
    opts.hour12 = false;
  }

  // FIXED_OFFSET: Intl no acepta "±HH:MM"; desplazamos y formateamos en UTC.
  if (setting.mode === "FIXED_OFFSET") {
    const shifted = ms + offsetMinutes(setting.value) * 60_000;
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(
      new Date(shifted)
    );
  }

  const tz = resolveTimeZone(setting, exchangeTimezone);
  // LOCAL: sin timeZone -> usa la del navegador.
  const finalOpts = tz ? { ...opts, timeZone: tz } : opts;
  try {
    return new Intl.DateTimeFormat("en-US", finalOpts).format(new Date(ms));
  } catch {
    // timeZone inválido -> cae a local.
    return new Intl.DateTimeFormat("en-US", opts).format(new Date(ms));
  }
}

/** Devuelve el IANA timeZone para Intl, o undefined para LOCAL. */
export function resolveTimeZone(
  setting: ChartTimezoneSetting,
  exchangeTimezone?: string | null
): string | undefined {
  switch (setting.mode) {
    case "UTC":
      return "UTC";
    case "IANA":
      return setting.value || "UTC";
    case "EXCHANGE":
      return exchangeTimezone || undefined; // sin exchange -> local
    case "LOCAL":
    default:
      return undefined;
  }
}

/** Etiqueta corta para mostrar la zona horaria seleccionada en el selector. */
export function timezoneLabel(
  setting: ChartTimezoneSetting,
  exchangeTimezone?: string | null
): string {
  switch (setting.mode) {
    case "EXCHANGE":
      return exchangeTimezone ? `Exchange (${exchangeTimezone})` : "Exchange";
    case "LOCAL":
      return "Local";
    case "UTC":
      return "UTC";
    case "FIXED_OFFSET":
      return FIXED_OFFSETS.find((o) => o.value === setting.value)?.label ?? "UTC";
    case "IANA":
      return IANA_PRESETS.find((o) => o.value === setting.value)?.label ?? setting.value ?? "IANA";
  }
}

/** Default: EXCHANGE si hay zona del exchange; si no, LOCAL. */
export function defaultTimezoneSetting(
  exchangeTimezone?: string | null
): ChartTimezoneSetting {
  return exchangeTimezone ? { mode: "EXCHANGE" } : { mode: "LOCAL" };
}

// ---- Persistencia en localStorage (fuente primaria del setting) ----
export function loadTimezoneSetting(): ChartTimezoneSetting {
  try {
    const mode = localStorage.getItem(LS_TIMEZONE_MODE) as ChartTimezoneMode | null;
    if (!mode) return DEFAULT_TIMEZONE_SETTING;
    const value = localStorage.getItem(LS_TIMEZONE_VALUE) || undefined;
    return { mode, value: value ?? undefined };
  } catch {
    return DEFAULT_TIMEZONE_SETTING;
  }
}

export function saveTimezoneSetting(setting: ChartTimezoneSetting): void {
  try {
    localStorage.setItem(LS_TIMEZONE_MODE, setting.mode);
    if (setting.value) localStorage.setItem(LS_TIMEZONE_VALUE, setting.value);
    else localStorage.removeItem(LS_TIMEZONE_VALUE);
  } catch {
    /* almacenamiento no disponible */
  }
}
