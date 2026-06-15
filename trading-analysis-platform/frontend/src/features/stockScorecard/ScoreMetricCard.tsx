// Tarjeta visual de una métrica del scorecard: valor + estado + aporte + fuente
// + explicación. Reemplaza las filas de tabla por algo más legible.
import {
  METRIC_STATUS_LABEL,
  METRIC_STATUS_TONE,
  TONE_BADGE,
  TONE_TEXT,
  type ScoreMetric,
} from "./stockScorecardTypes";
import { ScorecardInfoTooltip } from "./ScorecardInfoTooltip";
import { metricHelpKey } from "./scorecardMetricHelpKeyMap";

const SOURCE_SHORT: Record<string, string> = {
  "Internal technical calculation": "Técnico",
  "Yahoo Finance": "Yahoo",
  "News module": "Noticias",
  "Market data": "Mercado",
  "User drawings": "Dibujos",
  "Simulated Entries": "Sim",
};

export function ScoreMetricCard({ metric }: { metric: ScoreMetric }) {
  const tone = METRIC_STATUS_TONE[metric.status];
  const pct =
    metric.maxContribution > 0
      ? Math.max(
          0,
          Math.min(100, (metric.scoreContribution / metric.maxContribution) * 100)
        )
      : 0;
  const barColor =
    tone === "good" ? "bg-emerald-500" : tone === "bad" ? "bg-red-500" : "bg-amber-500";

  return (
    <div
      data-testid={`metric-card-${metric.key}`}
      title={metric.explanation}
      className="flex flex-col gap-1 rounded-lg border border-edge bg-panel-2 p-2"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] text-muted">{metric.label}</span>
        <span className="flex shrink-0 items-center gap-1">
          <span className={`rounded border px-1 py-0.5 text-[9px] ${TONE_BADGE[tone]}`}>
            {METRIC_STATUS_LABEL[metric.status]}
          </span>
          <ScorecardInfoTooltip helpKey={metricHelpKey(metric.key)} />
        </span>
      </div>
      <span className={`font-mono text-base font-bold ${TONE_TEXT[tone]}`}>
        {metric.displayValue}
      </span>
      {metric.maxContribution > 0 && (
        <div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-panel-3">
            <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[9px] text-muted">
            {metric.scoreContribution} / {metric.maxContribution} pts
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[9px] text-muted">{metric.explanation}</span>
        <span className="shrink-0 rounded bg-panel-3 px-1 text-[9px] text-muted">
          {SOURCE_SHORT[metric.source] ?? metric.source}
        </span>
      </div>
    </div>
  );
}

/** Agrupa las métricas de una sección por bloques visuales según su `key`. */
export interface MetricGroup {
  title: string;
  keys: string[];
}

export const TECHNICAL_GROUPS: MetricGroup[] = [
  { title: "Tendencia", keys: ["price", "priceVsSma20", "priceVsSma50", "priceVsSma200", "smaCross"] },
  { title: "Momentum", keys: ["rsi14", "macd", "bollinger"] },
  { title: "Riesgo / Beneficio", keys: ["rangePosition", "channelRiskReward", "volume"] },
];

export const FUNDAMENTAL_GROUPS: MetricGroup[] = [
  { title: "Valuación", keys: ["peRatio", "priceToSales", "priceToBook"] },
  { title: "Rentabilidad", keys: ["roe", "roa", "profitMargin"] },
  { title: "Crecimiento", keys: ["revenueGrowth"] },
  { title: "Balance", keys: ["debtToEquity", "currentRatio", "dividendYield"] },
];

/** Reparte las métricas en grupos; las que no encajen van a "Otros". */
export function groupMetrics(
  metrics: ScoreMetric[],
  groups: MetricGroup[]
): { title: string; metrics: ScoreMetric[] }[] {
  const byKey = new Map(metrics.map((m) => [m.key, m]));
  const used = new Set<string>();
  const out = groups.map((g) => {
    const items = g.keys
      .map((k) => byKey.get(k))
      .filter((m): m is ScoreMetric => {
        if (!m) return false;
        used.add(m.key);
        return true;
      });
    return { title: g.title, metrics: items };
  });
  const rest = metrics.filter((m) => !used.has(m.key));
  if (rest.length) out.push({ title: "Otros", metrics: rest });
  return out.filter((g) => g.metrics.length > 0);
}
