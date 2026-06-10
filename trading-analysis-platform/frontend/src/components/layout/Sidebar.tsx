import { SymbolCatalog } from "@/features/symbols/SymbolCatalog";

/** Sidebar izquierda con el catalogo/watchlist. */
export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-edge bg-panel">
      <div className="border-b border-edge px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Watchlist
      </div>
      <div className="flex-1 overflow-auto">
        <SymbolCatalog />
      </div>
    </aside>
  );
}
