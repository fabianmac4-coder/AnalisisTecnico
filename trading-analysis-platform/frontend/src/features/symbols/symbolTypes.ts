// Tipos del dominio de simbolos / catalogo.

export type SymbolType = "equity" | "etf" | "index" | "crypto" | "fx" | "unknown";

/** Informacion devuelta por el backend al buscar un ticker. */
export interface SymbolInfo {
  symbol: string;
  name?: string;
  exchange?: string;
  currency?: string;
  type: SymbolType;
  provider: "yahoo";
}

/** Entrada del catalogo lateral (watchlist), persistida localmente. */
export interface CatalogSymbol {
  id: string;
  symbol: string;
  name?: string;
  exchange?: string;
  currency?: string;
  type?: SymbolType;
  provider: "yahoo";
  pinned: boolean;
  tags: string[];
  lastViewedAt: string;
  createdAt: string;
  updatedAt: string;
}
