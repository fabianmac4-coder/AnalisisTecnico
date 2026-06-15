import { MacroRiskBadge } from "./MacroRiskBadge";
import { MacroRefreshButton } from "./MacroRefreshButton";
import type { MacroExecutiveSummary as Summary, MacroRisk } from "./macroTypes";

/** Resumen ejecutivo: riesgo macro + drivers/risks + última actualización. */
export function MacroExecutiveSummary({
  summary,
  risk,
  lastUpdated,
  fromCache,
}: {
  summary: Summary;
  risk: MacroRisk;
  lastUpdated: string | null;
  fromCache?: boolean;
}) {
  return (
    <section
      data-testid="macro-executive-summary"
      className="rounded-lg border border-edge bg-panel p-4"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-100">Riesgo macro</h2>
          <MacroRiskBadge level={summary.riskLevel} size="lg" />
          {risk.score != null && (
            <span className="text-[11px] text-muted">({risk.score}/100)</span>
          )}
        </div>
        <MacroRefreshButton />
      </div>

      <p className="text-xs text-gray-300">{summary.summary}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {risk.drivers.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase text-muted">Factores</p>
            <ul className="space-y-0.5">
              {risk.drivers.map((d, i) => (
                <li key={i} className="text-[11px] text-gray-300">• {d}</li>
              ))}
            </ul>
          </div>
        )}
        {risk.risks.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase text-muted">Riesgos</p>
            <ul className="space-y-0.5">
              {risk.risks.map((r, i) => (
                <li key={i} className="text-[11px] text-down">• {r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {lastUpdated && (
        <p className="mt-3 text-[10px] text-muted">
          Actualizado: {new Date(lastUpdated).toLocaleString()}
          {fromCache ? " (cache)" : ""}
        </p>
      )}
      <p className="mt-1 text-[9px] text-muted">
        Lectura macro informativa; no es señal de compra/venta.
      </p>
    </section>
  );
}
