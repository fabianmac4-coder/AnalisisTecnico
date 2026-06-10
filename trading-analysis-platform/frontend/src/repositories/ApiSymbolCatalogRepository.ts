// Watchlist en SQL via API (dbo.C040 + dbo.C010), acotada al usuario del token.

import type { CatalogSymbol } from "@/features/symbols/symbolTypes";
import { apiClient } from "@/services/apiClient";
import type { SymbolCatalogRepository } from "./SymbolCatalogRepository";

export class ApiSymbolCatalogRepository implements SymbolCatalogRepository {
  /** Cache ticker -> C010Id para resolver remove()/patch() por ticker. */
  private idBySymbol = new Map<string, string>();

  private remember(items: CatalogSymbol[]): void {
    for (const item of items) this.idBySymbol.set(item.symbol, item.id);
  }

  async list(): Promise<CatalogSymbol[]> {
    const items = await apiClient.get<CatalogSymbol[]>("/catalog");
    this.remember(items);
    return items;
  }

  async upsert(symbol: CatalogSymbol): Promise<CatalogSymbol> {
    const knownId = this.idBySymbol.get(symbol.symbol) ?? symbol.id;
    if (/^\d+$/.test(knownId)) {
      // Entrada existente: solo cambian pinned/lastViewedAt.
      const saved = await apiClient.patch<CatalogSymbol>(`/catalog/${knownId}`, {
        pinned: symbol.pinned,
        lastViewedAt: symbol.lastViewedAt,
        tags: symbol.tags,
      });
      this.remember([saved]);
      return saved;
    }
    const saved = await apiClient.post<CatalogSymbol>("/catalog", {
      symbol: symbol.symbol,
      name: symbol.name,
      exchange: symbol.exchange,
      currency: symbol.currency,
      type: symbol.type,
      pinned: symbol.pinned,
    });
    this.remember([saved]);
    return saved;
  }

  async remove(symbol: string): Promise<void> {
    let id = this.idBySymbol.get(symbol);
    if (!id) {
      await this.list(); // repuebla el cache
      id = this.idBySymbol.get(symbol);
    }
    if (!id) return;
    await apiClient.delete(`/catalog/${id}`);
    this.idBySymbol.delete(symbol);
  }
}
