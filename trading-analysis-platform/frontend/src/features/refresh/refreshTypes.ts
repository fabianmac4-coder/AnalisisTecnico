// Tipos del refresh manual y auto-refresh de datos de mercado.

/** Intervalos permitidos en minutos. null = apagado (Manual). */
export type AutoRefreshInterval = 1 | 5 | 10 | 15 | 20 | null;

export const AUTO_REFRESH_OPTIONS = [1, 5, 10, 15, 20] as const;

export const AUTO_REFRESH_STORAGE_KEY = "tradingPlatform.autoRefreshIntervalMinutes";

/** Etiqueta en español de una opción de auto-refresh ("Cada 1 minuto"...). */
export function autoRefreshOptionLabel(minutes: number): string {
  return minutes === 1 ? "Cada 1 minuto" : `Cada ${minutes} minutos`;
}
