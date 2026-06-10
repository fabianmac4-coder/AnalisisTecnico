/**
 * Parse seguro de estado persistido: un JSON corrupto en localStorage NUNCA
 * debe tirar la app. Devuelve el fallback y deja un warning.
 */
export function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("Failed to parse persisted state", error);
    return fallback;
  }
}
