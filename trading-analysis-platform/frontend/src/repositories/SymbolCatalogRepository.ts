import type { CatalogSymbol } from "@/features/symbols/symbolTypes";

export interface SymbolCatalogRepository {
  list(): Promise<CatalogSymbol[]>;
  upsert(symbol: CatalogSymbol): Promise<CatalogSymbol>;
  remove(symbol: string): Promise<void>;
}
