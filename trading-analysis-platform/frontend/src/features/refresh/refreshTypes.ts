// Tipos del refresh manual y auto-refresh de datos de mercado.

/** Intervalos permitidos (min. 5 para no saturar Yahoo). null = apagado. */
export type AutoRefreshInterval = 5 | 10 | 15 | 20 | null;

export const AUTO_REFRESH_OPTIONS = [5, 10, 15, 20] as const;

export const AUTO_REFRESH_STORAGE_KEY = "tradingPlatform.autoRefreshIntervalMinutes";
