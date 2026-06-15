import { SEVERITY_COLOR, type PortfolioAnalysis } from "./portfolioTypes";

/** Recomendaciones basadas en reglas (concentración, sector, diversificación…). */
export function PortfolioRecommendationsPanel({ analysis }: { analysis: PortfolioAnalysis }) {
  const recs = analysis.recommendations;
  return (
    <section data-testid="recommendations-panel" className="rounded-lg border border-edge bg-panel p-4">
      <h2 className="mb-2 text-sm font-bold text-gray-100">Recomendaciones</h2>
      {recs.length === 0 ? (
        <p className="text-xs text-muted">Sin alertas por ahora.</p>
      ) : (
        <ul className="space-y-1.5">
          {recs.map((r, i) => (
            <li key={i} data-testid="recommendation-item" className="flex gap-2 text-[11px]">
              <span className={`shrink-0 font-semibold ${SEVERITY_COLOR[r.severity] ?? "text-muted"}`}>
                [{r.severity}]
              </span>
              <span className="text-gray-300">{r.message}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[9px] text-muted">
        Sugerencias informativas (revisar/confirmar/monitorear); no es asesoría financiera.
      </p>
    </section>
  );
}
