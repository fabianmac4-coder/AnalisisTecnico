import type { CatalogSymbol } from "@/features/symbols/symbolTypes";
import { safeParseJson } from "@/utils/safeParseJson";
import type { SymbolCatalogRepository } from "./SymbolCatalogRepository";

const STORAGE_KEY = "tap.catalog.v1";

/** Catalogo (watchlist) persistido en localStorage, indexado por symbol. */
export class LocalStorageSymbolCatalogRepository implements SymbolCatalogRepository {
  private read(): Record<string, CatalogSymbol> {
    const parsed = safeParseJson<Record<string, CatalogSymbol>>(
      localStorage.getItem(STORAGE_KEY),
      {}
    );
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  }

  private write(data: Record<string, CatalogSymbol>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async list(): Promise<CatalogSymbol[]> {
    return Object.values(this.read());
  }

  async upsert(symbol: CatalogSymbol): Promise<CatalogSymbol> {
    const data = this.read();
    data[symbol.symbol] = symbol;
    this.write(data);
    return symbol;
  }

  async remove(symbol: string): Promise<void> {
    const data = this.read();
    delete data[symbol];
    this.write(data);
  }
}
