import { useMemo, useState } from "react";
import type { CatalogSymbol } from "@/features/symbols/symbolTypes";
import { useSymbolStore } from "@/stores/symbolStore";
import { useChartStore } from "@/stores/chartStore";
import { resolveDisplayPrice } from "@/features/charting/priceResolver";
import { formatPrice } from "@/utils/formatters";

/**
 * Catalogo lateral (watchlist) de tickers consultados.
 * - La estrella es C040.Favorito real: persiste y sirve para filtrar/ordenar.
 * - Quitar un ticker pide CONFIRMACION y solo desactiva C040 (jamas borra
 *   C010 ni dibujos/indicadores/chats).
 */
export function SymbolCatalog() {
  const catalog = useSymbolStore((s) => s.catalog);
  const activeSymbol = useSymbolStore((s) => s.activeSymbol);
  const selectSymbol = useSymbolStore((s) => s.selectSymbol);
  const pinSymbol = useSymbolStore((s) => s.pinSymbol);
  const removeSymbol = useSymbolStore((s) => s.removeSymbol);

  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState<CatalogSymbol | null>(null);
  const [removing, setRemoving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Precio canonico del simbolo activo (debe coincidir con el header).
  const quote = useChartStore((s) => (activeSymbol ? s.quoteBySymbol[activeSymbol] : undefined));
  const chartDataByPreset = useChartStore((s) => s.chartDataByPreset);
  const activePrice = resolveDisplayPrice(quote, chartDataByPreset).price;

  // Favoritos primero, luego por ultima vista; filtro "solo favoritos".
  const visible = useMemo(() => {
    const filtered = favoritesOnly ? catalog.filter((c) => c.pinned) : catalog;
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const byViewed = b.lastViewedAt.localeCompare(a.lastViewedAt);
      if (byViewed !== 0) return byViewed;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [catalog, favoritesOnly]);

  const confirmRemove = async () => {
    if (!confirmingRemove) return;
    setRemoving(true);
    try {
      await removeSymbol(confirmingRemove.symbol);
      setToast(`${confirmingRemove.symbol} se quitó de tu watchlist`);
      setTimeout(() => setToast(null), 3500);
    } finally {
      setRemoving(false);
      setConfirmingRemove(null);
    }
  };

  if (catalog.length === 0) {
    return (
      <div className="p-3 text-[11px] text-muted">
        Tu watchlist está vacía. Busca un ticker para agregarlo.
      </div>
    );
  }

  return (
    <div>
      {/* Filtro de favoritos */}
      <div className="flex items-center justify-between border-b border-edge px-3 py-1.5">
        <label className="flex items-center gap-1.5 text-[10px] text-muted">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(e) => setFavoritesOnly(e.target.checked)}
            data-testid="favorites-only-filter"
          />
          Solo favoritos ★
        </label>
        <span className="text-[10px] text-muted">
          {visible.length}/{catalog.length}
        </span>
      </div>

      {toast && (
        <p
          data-testid="watchlist-toast"
          className="border-b border-edge bg-green-500/10 px-3 py-1.5 text-[11px] text-up"
        >
          {toast}
        </p>
      )}

      {visible.length === 0 && favoritesOnly && (
        <p className="p-3 text-[11px] text-muted">
          No tienes favoritos. Marca la estrella ★ de un ticker.
        </p>
      )}

      <ul className="flex flex-col">
        {visible.map((c) => {
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
                title={c.pinned ? "Quitar de favoritos" : "Agregar a favoritos"}
                data-testid={`favorite-star-${c.symbol}`}
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
                title="Quitar del watchlist"
                data-testid={`remove-${c.symbol}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmingRemove(c);
                }}
                className="text-muted opacity-0 hover:text-down group-hover:opacity-100"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      {/* Modal de confirmacion: quitar SOLO afecta C040, nunca C010 ni datos. */}
      {confirmingRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-96 rounded-lg border border-edge bg-panel p-5">
            <h2 className="mb-2 text-sm font-bold text-gray-100">
              ¿Quitar del watchlist?
            </h2>
            <p className="mb-4 text-xs text-gray-300">
              Esto quitará <strong>{confirmingRemove.symbol}</strong> de tu
              watchlist. Tus dibujos, indicadores, layouts e historial de chat
              de IA <strong>no se borran</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmingRemove(null)}
                data-testid="remove-cancel"
                className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3"
              >
                Cancelar
              </button>
              <button
                onClick={() => void confirmRemove()}
                disabled={removing}
                data-testid="remove-confirm"
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {removing ? "Quitando…" : "Quitar del watchlist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
