import { useEffect, useState } from "react";
import { useSymbolStore } from "@/stores/symbolStore";
import { useNewsStore } from "./newsStore";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(minutes, 0)}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

/**
 * Panel compacto de noticias del simbolo activo (sidebar, colapsable).
 * Se carga de forma asincrona DESPUES de las graficas: jamas las bloquea.
 */
export function SymbolNewsPanel() {
  const symbol = useSymbolStore((s) => s.activeSymbol);
  const items = useNewsStore((s) => (symbol ? s.symbolItemsBySymbol[symbol] ?? [] : []));
  const loading = useNewsStore((s) => s.symbolLoading);
  const error = useNewsStore((s) => s.symbolError);
  const loadSymbol = useNewsStore((s) => s.loadSymbol);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (symbol && import.meta.env.MODE !== "test") void loadSymbol(symbol);
  }, [symbol, loadSymbol]);

  if (!symbol) return null;

  return (
    <div data-testid="symbol-news-panel" className="border-t border-edge">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-gray-200"
        >
          {collapsed ? "▸" : "▾"} Noticias {symbol}
        </button>
        <button
          onClick={() => void loadSymbol(symbol, true)}
          disabled={loading}
          data-testid="symbol-news-refresh"
          title="Actualizar noticias del ticker"
          className="rounded border border-edge bg-panel-2 px-1.5 py-0.5 text-[11px] text-gray-200 hover:bg-panel-3 disabled:opacity-40"
        >
          <span className={loading ? "inline-block animate-spin" : undefined}>⟳</span>
        </button>
      </div>

      {!collapsed && (
        <div className="px-2 pb-2">
          {error && (
            <p className="mb-1 rounded bg-red-500/10 px-2 py-1 text-[10px] text-down">
              No se pudieron cargar las noticias.
            </p>
          )}
          {loading && items.length === 0 ? (
            <div className="space-y-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-panel-2" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div data-testid="symbol-news-empty" className="px-1">
              {/* Filtro ESTRICTO: jamas se rellena con noticias genericas
                  irrelevantes (OPEN/AI/ON son palabras comunes en ingles). */}
              <p className="text-[11px] text-muted">
                No se encontraron noticias recientes altamente relevantes para{" "}
                {symbol}.
              </p>
              <p className="text-[10px] text-muted/70">
                Intenta refrescar o revisa las noticias globales del mercado.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {items.slice(0, 7).map((item) => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded px-1.5 py-1 text-[11px] leading-snug text-gray-200 hover:bg-panel-2"
                  >
                    {item.title}
                    <span className="ml-1 text-[9px] text-muted">
                      {item.publisher ? `${item.publisher} · ` : ""}
                      {timeAgo(item.publishedAt)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
