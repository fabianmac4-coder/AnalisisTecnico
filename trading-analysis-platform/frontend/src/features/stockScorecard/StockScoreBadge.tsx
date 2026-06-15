// Badge de la vista general del scorecard (etiqueta + color por tono).
import {
  OVERALL_VIEW_LABEL,
  OVERALL_VIEW_TONE,
  TONE_BADGE,
  type StockOverallView,
} from "./stockScorecardTypes";

interface Props {
  view: StockOverallView;
  overallScore: number | null;
}

export function StockScoreBadge({ view, overallScore }: Props) {
  const tone = OVERALL_VIEW_TONE[view];
  return (
    <div
      data-testid="scorecard-overall-badge"
      data-view={view}
      className={`flex items-center justify-between gap-2 rounded border px-2 py-1 text-[11px] ${TONE_BADGE[tone]}`}
    >
      <span className="font-semibold leading-tight">{OVERALL_VIEW_LABEL[view]}</span>
      {overallScore !== null && (
        <span className="shrink-0 font-mono text-sm font-bold">{overallScore}</span>
      )}
    </div>
  );
}
