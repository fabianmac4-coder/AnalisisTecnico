import { RISK_LEVEL_COLOR, RISK_LEVEL_LABEL, type PortfolioAnalysis } from "./portfolioTypes";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="font-mono text-xs text-gray-100">{value}</span>
    </div>
  );
}

/** Panel de riesgo: nivel + concentración + nota de métricas avanzadas. */
export function PortfolioRiskPanel({ analysis }: { analysis: PortfolioAnalysis }) {
  const r = analysis.risk;
  const cr = r.concentrationRisk;
  const sr = r.sectorRisk;
  const color = RISK_LEVEL_COLOR[r.riskLevel];

  return (
    <section data-testid="risk-panel" className="rounded-lg border border-edge bg-panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-100">Riesgo</h2>
        <span
          data-testid="risk-level-badge"
          className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {RISK_LEVEL_LABEL[r.riskLevel]}
        </span>
      </div>
      <div className="space-y-1">
        <Metric label="Mayor posición" value={cr.largestPositionTicker ? `${cr.largestPositionTicker} ${(cr.largestPositionWeight ?? 0).toFixed(1)}%` : "n/d"} />
        <Metric label="Top 3 posiciones" value={cr.top3Weight != null ? `${cr.top3Weight.toFixed(1)}%` : "n/d"} />
        <Metric label="Mayor sector" value={sr.largestSector ? `${sr.largestSector} ${(sr.largestSectorWeight ?? 0).toFixed(1)}%` : "n/d"} />
      </div>
      <div className="mt-3 border-t border-edge pt-2">
        <p className="text-[10px] font-semibold uppercase text-muted">Métricas avanzadas</p>
        {r.advancedMetricsAvailable ? (
          <div className="mt-1 space-y-1">
            <Metric label="Beta" value={String(r.estimatedBeta ?? "n/d")} />
            <Metric label="Volatilidad" value={String(r.estimatedVolatility ?? "n/d")} />
            <Metric label="Sharpe" value={String(r.sharpeRatio ?? "n/d")} />
            <Metric label="Max drawdown" value={String(r.maxDrawdown ?? "n/d")} />
          </div>
        ) : (
          <p data-testid="risk-advanced-unavailable" className="mt-1 text-[10px] text-muted">
            {r.advancedMetricsNote}
          </p>
        )}
      </div>
    </section>
  );
}
