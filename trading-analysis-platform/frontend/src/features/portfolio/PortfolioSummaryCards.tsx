import { money, pct, gainClass } from "./portfolioFormat";
import type { PortfolioAnalysis } from "./portfolioTypes";

function Card({ label, value, cls }: { label: string; value: React.ReactNode; cls?: string }) {
  return (
    <div className="rounded-lg border border-edge bg-panel-2 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-mono text-base font-bold ${cls ?? "text-gray-100"}`}>{value}</p>
    </div>
  );
}

/** Fila de tarjetas resumen del portafolio. */
export function PortfolioSummaryCards({ analysis }: { analysis: PortfolioAnalysis }) {
  const s = analysis.summary;
  const cur = analysis.portfolio.baseCurrency;
  return (
    <div
      data-testid="portfolio-summary"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
    >
      <Card label="Costo total" value={money(s.totalCost, cur)} />
      <Card label="Valor actual" value={money(s.currentValue, cur)} />
      <Card label="P/L $" value={money(s.totalGainLoss, cur)} cls={gainClass(s.totalGainLoss)} />
      <Card label="P/L %" value={pct(s.totalGainLossPercent)} cls={gainClass(s.totalGainLossPercent)} />
      <Card
        label="Mejor posición"
        value={s.bestPosition ? `${s.bestPosition.ticker} ${pct(s.bestPosition.gainLossPercent)}` : "n/d"}
        cls={s.bestPosition ? gainClass(s.bestPosition.gainLossPercent) : undefined}
      />
      <Card
        label="Peor posición"
        value={s.worstPosition ? `${s.worstPosition.ticker} ${pct(s.worstPosition.gainLossPercent)}` : "n/d"}
        cls={s.worstPosition ? gainClass(s.worstPosition.gainLossPercent) : undefined}
      />
    </div>
  );
}
