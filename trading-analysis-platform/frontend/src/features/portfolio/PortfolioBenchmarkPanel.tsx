import { pct, gainClass } from "./portfolioFormat";
import type { PortfolioAnalysis } from "./portfolioTypes";

/** Comparación del portafolio vs S&P 500 (si hay fechas de compra). */
export function PortfolioBenchmarkPanel({ analysis }: { analysis: PortfolioAnalysis }) {
  const b = analysis.benchmark;
  return (
    <section data-testid="benchmark-panel" className="rounded-lg border border-edge bg-panel p-4">
      <h2 className="mb-2 text-sm font-bold text-gray-100">Comparación vs {b.benchmarkName}</h2>
      {!b.available ? (
        <p data-testid="benchmark-unavailable" className="text-xs text-muted">
          {b.message ?? "Comparación con el índice no disponible."}
        </p>
      ) : (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted">Retorno del portafolio</span>
            <span className={`font-mono ${gainClass(b.portfolioReturn)}`}>{pct(b.portfolioReturn)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">{b.benchmarkName}</span>
            <span className={`font-mono ${gainClass(b.benchmarkReturn)}`}>{pct(b.benchmarkReturn)}</span>
          </div>
          <div className="flex justify-between border-t border-edge pt-1">
            <span className="text-muted">Alpha estimado</span>
            <span className={`font-mono font-semibold ${gainClass(b.alphaEstimate)}`}>{pct(b.alphaEstimate)}</span>
          </div>
          {b.note && <p className="mt-1 text-[10px] italic text-muted">{b.note}</p>}
        </div>
      )}
    </section>
  );
}
