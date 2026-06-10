import { useMemo } from "react";
import { useSymbolStore } from "@/stores/symbolStore";
import { useChartStore } from "@/stores/chartStore";
import { resolveDisplayPrice } from "@/features/charting/priceResolver";
import { formatPrice } from "@/utils/formatters";

/** Catalogo lateral (watchlist) de tickers consultados. */
export function SymbolCatalog() {
  const catalog = useSymbolStore((s) => s.catalog);
  const activeSymbol = useSymbolStore((s) => s.activeSymbol);
  const selectSymbol = useSymbolStore((s) => s.selectSymbol);
  const pinSymbol = useSymbolStore((s) => s.pinSymbol);
  const removeSymbol = useSymbolStore((s) => s.removeSymbol);

  // Precio canonico del simbolo activo (debe coincidir con el header).
  const quote = useChartStore((s) => (activeSymbol ? s.quoteBySymbol[activeSymbol] : undefined));
  const chartDataByPreset = useChartStore((s) => s.chartDataByPreset);
  const activePrice = resolveDisplayPrice(quote, chartDataByPreset).price;

  // Fijados primero, luego por ultima vista.
  const sorted = useMemo(
    () =>
      [...catalog].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.lastViewedAt.localeCompare(a.lastViewedAt);
      }),
    [catalog]
  );

  if (catalog.length === 0) {
    return (
      <div className="p-3 text-[11px] text-muted">
        Tu watchlist está vacía. Busca un ticker para agregarlo.
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {sorted.map((c) => {
        const active = c.symbol === activeSymbol;
        return (
          <li
            key={c.id}
            className={`group flex cursor-pointer items-center gap-2 border-l-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-accent bg-panel-3"
                : "border-transparent hover:bg-panel-2"
            }`}
            onClick={() => void selectSymbol(c.symbol)}
          >
            <button
              title={c.pinned ? "Quitar de favoritos" : "Marcar favorito"}
              onClick={(e) => {
                e.stopPropagation();
                void pinSymbol(c.symbol);
              }}
              className={c.pinned ? "text-yellow-400" : "text-muted hover:text-yellow-400"}
            >
              {c.pinned ? "★" : "☆"}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-gray-100">{c.symbol}</span>
                {c.type && c.type !== "unknown" && (
                  <span className="rounded bg-panel-3 px-1 text-[9px] uppercase text-muted">
                    {c.type}
                  </span>
                )}
              </div>
              {c.name && <div className="truncate text-[11px] text-muted">{c.name}</div>}
            </div>
            {active && activePrice !== null && (
              <span className="font-mono text-[11px] text-gray-100">
                {formatPrice(activePrice, quote?.currency)}
              </span>
            )}
            <button
              title="Eliminar del catálogo"
              onClick={(e) => {
                e.stopPropagation();
                void removeSymbol(c.symbol);
              }}
              className="text-muted opacity-0 hover:text-down group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}
