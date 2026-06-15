import { useMarketIntelligenceStore } from "./marketIntelligenceStore";

/** Botón de refresco (forceRefresh) del overview de mercado. */
export function MarketIntelligenceRefreshButton() {
  const load = useMarketIntelligenceStore((s) => s.load);
  const loading = useMarketIntelligenceStore((s) => s.loading);

  return (
    <button
      onClick={() => void load(true)}
      disabled={loading}
      data-testid="market-intelligence-refresh"
      className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3 disabled:opacity-50"
    >
      {loading ? "Actualizando…" : "↻ Actualizar"}
    </button>
  );
}
