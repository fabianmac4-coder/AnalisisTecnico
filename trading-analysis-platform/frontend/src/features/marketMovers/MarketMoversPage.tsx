import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MarketMoverTable } from "./MarketMoverTable";
import { useMarketMoversStore } from "./marketMoversStore";
import { MOVERS_TABS } from "./marketMoversTypes";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

/** /market-movers — Tendencia, subidas, caídas y más activas (Yahoo). */
export function MarketMoversPage() {
  const data = useMarketMoversStore((s) => s.data);
  const activeTab = useMarketMoversStore((s) => s.activeTab);
  const loading = useMarketMoversStore((s) => s.loading);
  const error = useMarketMoversStore((s) => s.error);
  const load = useMarketMoversStore((s) => s.load);
  const setTab = useMarketMoversStore((s) => s.setTab);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta.env.MODE !== "test") void load();
  }, [load]);

  const current = data?.[activeTab];

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0d1017] p-6 text-gray-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold">Market Movers</h1>
            <p className="text-[11px] text-muted">
              Última actualización: {formatTime(current?.lastUpdated ?? null)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load(true)}
              disabled={loading}
              data-testid="movers-refresh"
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

        {/* Tabs de las cuatro listas */}
        <div className="mb-3 flex gap-1.5" data-testid="movers-tabs">
          {MOVERS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              data-testid={`movers-tab-${tab.key}`}
              className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                activeTab === tab.key
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-edge bg-panel-2 text-muted hover:bg-panel-3 hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {notice && (
          <p
            data-testid="movers-toast"
            className="mb-2 rounded bg-green-500/10 px-3 py-1.5 text-[11px] text-up"
          >
            {notice}
          </p>
        )}
        {error && (
          <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-xs text-down">
            Los market movers no están disponibles por ahora. ({error})
          </p>
        )}
        {data?.warnings.map((w) => (
          <p key={w} className="mb-2 rounded bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
            {w}
          </p>
        ))}

        <div className="overflow-x-auto rounded-lg border border-edge bg-panel">
          {loading && !data ? (
            <div className="space-y-2 p-4" data-testid="movers-skeleton">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-panel-2" />
              ))}
            </div>
          ) : (
            <MarketMoverTable items={current?.items ?? []} onNotice={showNotice} />
          )}
        </div>
        <p className="mt-2 text-[10px] text-muted">
          Fuente: Yahoo Finance (best-effort, cache de {""}5 min). Información de
          mercado, no asesoría financiera.
        </p>
      </div>
    </div>
  );
}
