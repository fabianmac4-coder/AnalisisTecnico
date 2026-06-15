import { usePortfolioStore } from "./portfolioStore";

/** Resumen del portafolio generado por IA (bajo demanda; no se ejecuta solo). */
export function PortfolioAiSummaryPanel() {
  const summary = usePortfolioStore((s) => s.aiSummary);
  const message = usePortfolioStore((s) => s.aiMessage);
  const loading = usePortfolioStore((s) => s.aiLoading);
  const generate = usePortfolioStore((s) => s.generateAiSummary);

  return (
    <section data-testid="ai-summary-panel" className="rounded-lg border border-edge bg-panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-100">Resumen con IA</h2>
        <button
          onClick={() => void generate()}
          disabled={loading}
          data-testid="ai-summary-generate"
          className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-accent hover:bg-panel-3 disabled:opacity-50"
        >
          {loading ? "Generando…" : "✨ Generar resumen con IA"}
        </button>
      </div>
      {summary ? (
        <p data-testid="ai-summary-text" className="whitespace-pre-wrap text-xs leading-relaxed text-gray-300">
          {summary}
        </p>
      ) : message ? (
        <p data-testid="ai-summary-message" className="text-xs text-muted">{message}</p>
      ) : (
        <p className="text-xs text-muted">
          Genera un resumen en español de la salud del portafolio. No es asesoría financiera.
        </p>
      )}
    </section>
  );
}
