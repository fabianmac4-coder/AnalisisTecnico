import { useEffect } from "react";
import { Link } from "react-router-dom";
import { usePortfolioStore } from "./portfolioStore";
import { PortfolioEmptyState } from "./PortfolioEmptyState";
import { PortfolioSelector } from "./PortfolioSelector";
import { PortfolioSummaryCards } from "./PortfolioSummaryCards";
import { PositionsTable } from "./PositionsTable";
import { PositionFormModal } from "./PositionFormModal";
import { PortfolioAllocationCharts } from "./PortfolioAllocationCharts";
import { PortfolioRiskPanel } from "./PortfolioRiskPanel";
import { PortfolioBenchmarkPanel } from "./PortfolioBenchmarkPanel";
import { PortfolioRecommendationsPanel } from "./PortfolioRecommendationsPanel";
import { PortfolioAiSummaryPanel } from "./PortfolioAiSummaryPanel";

function createPortfolioPrompt(create: (b: { name: string }) => Promise<boolean>) {
  const name = window.prompt("Nombre del nuevo portafolio:", "Largo plazo");
  if (name && name.trim()) void create({ name: name.trim() });
}

function exportCsv(analysisPositions: { ticker: string; quantity: number; averageCost: number; currentPrice: number | null; currentValue: number | null; gainLossPercent: number | null; sector?: string | null }[]) {
  const header = "Ticker,Quantity,AverageCost,CurrentPrice,CurrentValue,GainLossPercent,Sector";
  const rows = analysisPositions.map((p) =>
    [p.ticker, p.quantity, p.averageCost, p.currentPrice ?? "", p.currentValue ?? "", p.gainLossPercent ?? "", p.sector ?? ""].join(",")
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "portfolio_positions.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Portfolio Analysis (Fase 4): crea portafolios, agrega posiciones y analiza
 * valor, ganancia/pérdida, asignación, concentración y comparación vs S&P 500.
 * Informativo; separado del watchlist. No es asesoría financiera.
 */
export function PortfolioPage() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const loading = usePortfolioStore((s) => s.loading);
  const analysis = usePortfolioStore((s) => s.analysis);
  const analysisLoading = usePortfolioStore((s) => s.analysisLoading);
  const error = usePortfolioStore((s) => s.error);
  const load = usePortfolioStore((s) => s.loadPortfolios);
  const createPortfolio = usePortfolioStore((s) => s.createPortfolio);
  const openModal = usePortfolioStore((s) => s.openPositionModal);

  useEffect(() => {
    if (import.meta.env.MODE !== "test") void load();
  }, [load]);

  const noPortfolios = !loading && portfolios.length === 0;

  return (
    <div className="min-h-screen bg-[#0d1017] p-6 text-gray-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold">Portafolio</h1>
            <p className="text-[11px] text-muted">
              Crea portafolios, agrega posiciones y analiza valor, asignación, concentración
              y comparación con el mercado. Separado del watchlist; no es asesoría financiera.
            </p>
          </div>
          <Link to="/" className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3">
            ← Volver
          </Link>
        </div>

        {error && <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-xs text-down">{error}</p>}

        {noPortfolios ? (
          <PortfolioEmptyState onCreate={() => createPortfolioPrompt(createPortfolio)} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PortfolioSelector onCreate={() => createPortfolioPrompt(createPortfolio)} />
              <div className="flex gap-2">
                <button onClick={() => openModal()} data-testid="add-position-btn" className="rounded bg-accent px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-500">
                  ＋ Posición
                </button>
                {analysis && analysis.positions.length > 0 && (
                  <button onClick={() => exportCsv(analysis.positions)} className="rounded border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3">
                    Exportar CSV
                  </button>
                )}
              </div>
            </div>

            {analysisLoading && !analysis ? (
              <div data-testid="portfolio-skeleton" className="h-40 animate-pulse rounded-lg bg-panel-2" />
            ) : analysis ? (
              <>
                <PortfolioSummaryCards analysis={analysis} />
                {analysis.warnings.map((w, i) => (
                  <p key={i} className="rounded bg-yellow-500/10 px-3 py-1.5 text-[11px] text-yellow-300">{w}</p>
                ))}
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <PositionsTable analysis={analysis} />
                  </div>
                  <div className="space-y-4">
                    <PortfolioAllocationCharts analysis={analysis} />
                    <PortfolioRiskPanel analysis={analysis} />
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <PortfolioBenchmarkPanel analysis={analysis} />
                  <PortfolioRecommendationsPanel analysis={analysis} />
                </div>
                <PortfolioAiSummaryPanel />
              </>
            ) : (
              <p className="text-sm text-muted">Selecciona un portafolio para ver su análisis.</p>
            )}
          </div>
        )}
      </div>
      <PositionFormModal />
    </div>
  );
}
