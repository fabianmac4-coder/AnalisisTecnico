import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useMarketIntelligenceStore } from "./marketIntelligenceStore";
import { MajorIndicesPanel } from "./MajorIndicesPanel";
import { MarketSentimentPanel } from "./MarketSentimentPanel";
import { MarketMoversSummaryPanel } from "./MarketMoversSummaryPanel";
import { MarketNewsSummaryPanel } from "./MarketNewsSummaryPanel";
import { WhatThisMeansPanel } from "./WhatThisMeansPanel";
import { MarketIntelligenceRefreshButton } from "./MarketIntelligenceRefreshButton";
import { MacroRiskMiniCard } from "@/features/macro/MacroRiskMiniCard";

/**
 * Página de Inteligencia de Mercado (Fase 2): visión rápida del entorno antes de
 * analizar una acción. Proxy de sentimiento; NO es asesoría financiera.
 */
export function MarketIntelligencePage() {
  const overview = useMarketIntelligenceStore((s) => s.overview);
  const loading = useMarketIntelligenceStore((s) => s.loading);
  const error = useMarketIntelligenceStore((s) => s.error);
  const load = useMarketIntelligenceStore((s) => s.load);

  useEffect(() => {
    if (import.meta.env.MODE !== "test") void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#0d1017] p-6 text-gray-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold">Inteligencia de Mercado</h1>
            <p className="text-[11px] text-muted">
              Visión rápida del entorno antes de analizar una acción. Proxy de
              sentimiento, no es señal de compra/venta.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <MarketIntelligenceRefreshButton />
            <Link
              to="/"
              className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
            >
              ← Volver
            </Link>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-xs text-down">{error}</p>
        )}
        {overview?.warnings?.map((w, i) => (
          <p
            key={i}
            data-testid="mi-warning"
            className="mb-2 rounded bg-yellow-500/10 px-3 py-1.5 text-[11px] text-yellow-300"
          >
            {w}
          </p>
        ))}

        {loading && !overview ? (
          <div data-testid="mi-skeleton" className="space-y-3">
            <div className="h-40 animate-pulse rounded-lg bg-panel-2" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-panel-2" />
              ))}
            </div>
          </div>
        ) : !overview ? (
          <p className="text-sm text-muted">Sin datos de mercado por ahora.</p>
        ) : (
          <div className="space-y-4">
            {/* Fila 1: sentimiento + qué significa (+ riesgo macro si disponible). */}
            <div className="grid gap-4 lg:grid-cols-2">
              <MarketSentimentPanel sentiment={overview.sentiment} />
              <div className="space-y-4">
                <WhatThisMeansPanel bullets={overview.whatThisMeans} />
                <MacroRiskMiniCard />
              </div>
            </div>

            {/* Fila 2: índices. */}
            <MajorIndicesPanel indices={overview.indices} />

            {/* Fila 3: movers + noticias. */}
            <div className="grid gap-4 lg:grid-cols-2">
              <MarketMoversSummaryPanel summary={overview.marketMoversSummary} />
              <MarketNewsSummaryPanel items={overview.topNews} />
            </div>

            {overview.lastUpdated && (
              <p className="text-[10px] text-muted">
                Actualizado: {new Date(overview.lastUpdated).toLocaleString()}
                {overview.fromCache ? " (cache)" : ""}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
