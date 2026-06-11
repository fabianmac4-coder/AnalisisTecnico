import { useNavigate } from "react-router-dom";
import { useSymbolStore } from "@/stores/symbolStore";
import { useNewsStore } from "./newsStore";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${Math.max(minutes, 0)} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `hace ${hours} h` : `hace ${Math.floor(hours / 24)} d`;
}

/**
 * Seccion destacada de /news: acciones en movimiento HOY y la noticia/
 * catalizador detras (distinta de la pagina Market Movers, que son listas).
 */
export function TopTrendingStocksTodayPanel() {
  const items = useNewsStore((s) => s.trendingItems);
  const loading = useNewsStore((s) => s.trendingLoading);
  const lastUpdated = useNewsStore((s) => s.trendingLastUpdated);
  const loadTrending = useNewsStore((s) => s.loadTrending);
  const navigate = useNavigate();
  const searchSymbol = useSymbolStore((s) => s.searchSymbol);

  const openTicker = async (ticker: string) => {
    navigate("/");
    await searchSymbol(ticker);
  };

  return (
    <section
      data-testid="trending-stocks-panel"
      className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-100">
          🔥 Top Trending Stocks Today
        </h2>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-muted">{timeAgo(lastUpdated)}</span>
          )}
          <button
            onClick={() => void loadTrending(true)}
            disabled={loading}
            data-testid="trending-refresh"
            className="rounded border border-edge bg-panel-2 px-2 py-0.5 text-[11px] text-gray-200 hover:bg-panel-3 disabled:opacity-40"
          >
            <span className={loading ? "inline-block animate-spin" : undefined}>⟳</span>
          </button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-panel-2" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-muted">
          Aún no hay titulares de acciones en movimiento hoy.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 8).map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate rounded px-1.5 py-1 text-[12px] text-gray-200 hover:bg-panel-2"
                title={item.title}
              >
                {item.title}
                <span className="ml-1 text-[10px] text-muted">
                  {item.publisher ? `${item.publisher} · ` : ""}
                  {timeAgo(item.publishedAt ?? item.fetchedAt)}
                </span>
              </a>
              {item.relatedTickers.slice(0, 2).map((ticker) => (
                <button
                  key={ticker}
                  onClick={() => void openTicker(ticker)}
                  data-testid={`trending-ticker-${ticker}`}
                  title={`Abrir ${ticker} en las gráficas`}
                  className="shrink-0 rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] text-accent hover:bg-accent/30"
                >
                  {ticker}
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
