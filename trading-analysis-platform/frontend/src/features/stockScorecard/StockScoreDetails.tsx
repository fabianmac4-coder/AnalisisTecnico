// Detalle expandido del scorecard: fortalezas/riesgos/vigilar + disponibilidad
// de datos + avisos.
import { StockScoreStrengthsRisks } from "./StockScoreStrengthsRisks";
import type { StockScorecardResponse } from "./stockScorecardTypes";

interface Props {
  scorecard: StockScorecardResponse;
}

function Availability({
  label,
  available,
}: {
  label: string;
  available: boolean;
}) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] ${
        available ? "bg-emerald-900/40 text-emerald-300" : "bg-panel-3 text-muted"
      }`}
    >
      {available ? "✓" : "—"} {label}
    </span>
  );
}

export function StockScoreDetails({ scorecard }: Props) {
  const a = scorecard.dataAvailability;
  return (
    <div className="space-y-2 border-t border-edge pt-2" data-testid="scorecard-details">
      <StockScoreStrengthsRisks
        strengths={scorecard.strengths}
        risks={scorecard.risks}
        watchItems={scorecard.watchItems}
      />

      <div>
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Disponibilidad de datos
        </p>
        <div className="flex flex-wrap gap-1">
          <Availability label="Técnico" available={a.technical} />
          <Availability label="Fundamentales" available={a.fundamentals} />
          <Availability label="Noticias" available={a.news} />
          <Availability label="Sentimiento" available={a.sentiment} />
        </div>
      </div>

      {scorecard.warnings.length > 0 && (
        <ul className="space-y-0.5" data-testid="scorecard-warnings">
          {scorecard.warnings.map((w, i) => (
            <li key={i} className="text-[10px] text-amber-400">
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
