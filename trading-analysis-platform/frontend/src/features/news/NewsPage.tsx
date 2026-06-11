import { useEffect } from "react";
import { Link } from "react-router-dom";
import { NewsCard } from "./NewsCard";
import { NewsFilters } from "./NewsFilters";
import { TopTrendingStocksTodayPanel } from "./TopTrendingStocksTodayPanel";
import { NEWS_SOURCES } from "./newsTypes";
import { useNewsStore } from "./newsStore";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

/**
 * /news — noticias globales de mercado/geopolitica (cache SQL del backend,
 * proveedores Yahoo/Google News). Mas recientes primero.
 */
export function NewsPage() {
  const items = useNewsStore((s) => s.globalItems);
  const loading = useNewsStore((s) => s.globalLoading);
  const error = useNewsStore((s) => s.globalError);
  const warnings = useNewsStore((s) => s.globalWarnings);
  const lastUpdated = useNewsStore((s) => s.globalLastUpdated);
  const loadGlobal = useNewsStore((s) => s.loadGlobal);
  const loadTrending = useNewsStore((s) => s.loadTrending);
  const source = useNewsStore((s) => s.globalSource);
  const setSource = useNewsStore((s) => s.setSource);

  useEffect(() => {
    if (import.meta.env.MODE !== "test") {
      void loadGlobal();
      void loadTrending();
    }
  }, [loadGlobal, loadTrending]);

  return (
    <div className="min-h-screen bg-[#0d1017] p-6 text-gray-100">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold">Noticias de mercado</h1>
            <p className="text-[11px] text-muted">
              Última actualización: {formatTime(lastUpdated)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadGlobal(undefined, true)}
              disabled={loading}
              data-testid="news-refresh"
              className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3 disabled:opacity-40"
            >
              <span className={loading ? "inline-block animate-spin" : undefined}>⟳</span>{" "}
              Actualizar
            </button>
            <Link
              to="/"
              className="rounded border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
            >
              ← Gráficas
            </Link>
          </div>
        </div>

        <TopTrendingStocksTodayPanel />

        <div className="mb-2">
          <NewsFilters />
        </div>
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[10px] text-muted">Fuente:</span>
          {NEWS_SOURCES.map((s) => (
            <button
              key={s.value}
              onClick={() => void setSource(s.value)}
              data-testid={`news-source-${s.value}`}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                source === s.value
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-edge bg-panel-2 text-muted hover:bg-panel-3 hover:text-gray-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-xs text-down">
            No se pudieron actualizar las noticias; se muestran los titulares en cache. ({error})
          </p>
        )}
        {warnings.map((w) => (
          <p key={w} className="mb-2 rounded bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
            {w}
          </p>
        ))}

        {loading && items.length === 0 ? (
          <div className="space-y-2" data-testid="news-skeleton">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded border border-edge bg-panel-2" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">
            No hay titulares para este filtro. Prueba "All" o actualiza las
            noticias.
          </p>
        ) : (
          <div className="space-y-2" data-testid="news-list">
            {items.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
