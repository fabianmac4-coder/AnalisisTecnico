// Nombre para mostrar del instrumento activo. El header solía mostrar SOLO el
// ticker; ahora muestra "TICKER · Nombre" cuando se conoce el nombre (catálogo
// o scorecard). Si no hay nombre, cae al ticker.

/** Primer valor no vacío (trim) de la lista, o undefined. */
export function firstNonEmpty(...vals: (string | null | undefined)[]): string | undefined {
  for (const v of vals) {
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * "AAPL · Apple Inc." si se conoce el nombre y difiere del ticker; si no, el
 * ticker solo. `names` se evalúa por orden de preferencia (catálogo, longName,
 * shortName, companyName del scorecard…).
 */
export function formatInstrumentDisplayName(
  ticker: string,
  ...names: (string | null | undefined)[]
): string {
  const name = firstNonEmpty(...names);
  if (name && name.toUpperCase() !== ticker.toUpperCase()) {
    return `${ticker} · ${name}`;
  }
  return ticker;
}
