// Vista completa (modal) del Stock Scorecard: gauge general, cuatro tarjetas de
// puntaje, pestañas con el DATO REAL de cada métrica (valor, fuente, contribución)
// y pestaña de ajustes de puntuación. NO es asesoría financiera.
import { useState } from "react";
import { createPortal } from "react-dom";
import { useStockScorecardStore, selectScorecard } from "./stockScorecardStore";
import { ScorecardSettings } from "./ScorecardSettings";
import { StockScoreBadge } from "./StockScoreBadge";
import { ScorecardInfoTooltip } from "./ScorecardInfoTooltip";
import {
  ScoreMetricCard,
  groupMetrics,
  TECHNICAL_GROUPS,
  FUNDAMENTAL_GROUPS,
} from "./ScoreMetricCard";
import {
  CONFIDENCE_LABEL,
  RISK_LABEL,
  RISK_TONE,
  TONE_TEXT,
  scoreTone,
  type ScoreBreakdownSection,
  type StockScorecardResponse,
} from "./stockScorecardTypes";

type SectionKey = "technical" | "fundamentals" | "news" | "sentiment";
type Tab = SectionKey | "settings";

const SECTION_LABEL: Record<SectionKey, string> = {
  technical: "Técnico",
  fundamentals: "Fundamental",
  news: "Noticias",
  sentiment: "Sentimiento",
};

function ScoreCard({
  label,
  score,
  active,
  onClick,
  helpKey,
}: {
  label: string;
  score: number | null;
  active: boolean;
  onClick: () => void;
  helpKey?: string;
}) {
  // El "?" va FUERA del <button> (hermano absoluto) para no anidar botones.
  return (
    <div className="relative">
      {helpKey && (
        <span className="absolute right-1 top-1 z-10">
          <ScorecardInfoTooltip helpKey={helpKey} />
        </span>
      )}
      <button
        onClick={onClick}
        data-testid={`scorecard-card-${label}`}
        className={`flex w-full flex-col items-center rounded-lg border px-3 py-2 ${
          active ? "border-accent bg-panel-3" : "border-edge bg-panel-2 hover:bg-panel-3"
        }`}
      >
        <span className={`font-mono text-2xl font-bold ${TONE_TEXT[scoreTone(score)]}`}>
          {score === null ? "—" : score}
        </span>
        <div className="my-1 h-1 w-full overflow-hidden rounded bg-panel-3">
          <div
            className={
              scoreTone(score) === "good"
                ? "h-full bg-emerald-500"
                : scoreTone(score) === "bad"
                  ? "h-full bg-red-500"
                  : scoreTone(score) === "warn"
                    ? "h-full bg-amber-500"
                    : "h-full bg-edge"
            }
            style={{ width: `${score === null ? 0 : Math.max(0, Math.min(100, score))}%` }}
          />
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      </button>
    </div>
  );
}

function SectionView({
  section,
  which,
}: {
  section: ScoreBreakdownSection;
  which: SectionKey;
}) {
  if (!section.metrics.length) {
    return (
      <p className="p-3 text-xs text-muted" data-testid="scorecard-metrics-empty">
        Sin métricas disponibles para esta sección.
      </p>
    );
  }
  const groups =
    which === "technical"
      ? groupMetrics(section.metrics, TECHNICAL_GROUPS)
      : which === "fundamentals"
        ? groupMetrics(section.metrics, FUNDAMENTAL_GROUPS)
        : [{ title: which === "news" ? "Titulares" : "Mercado", metrics: section.metrics }];

  return (
    <div className="space-y-3" data-testid="scorecard-metrics">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {g.title}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.metrics.map((m) => (
              <ScoreMetricCard key={m.key} metric={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FullViewBody({
  sc,
  symbol,
  onClose,
}: {
  sc: StockScorecardResponse;
  symbol: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("technical");
  const breakdown = sc.breakdown;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-3">
      <div className="flex max-h-full flex-1 flex-col overflow-hidden rounded-lg border border-edge bg-panel">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-edge px-4 py-2">
          <div>
            <span className="text-sm font-semibold text-gray-100">
              {symbol} · Análisis de la acción
            </span>
            {sc.companyName && (
              <span className="ml-2 text-xs text-muted">{sc.companyName}</span>
            )}
            {sc.scoringConfig && (
              <span className="ml-2 text-[10px] text-muted">
                config: {sc.scoringConfig.name}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            data-testid="scorecard-full-close"
            className="rounded bg-panel-3 px-3 py-1 text-xs hover:bg-edge"
          >
            Cerrar ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {/* Resumen ejecutivo */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <StockScoreBadge view={sc.overallView} overallScore={sc.overallScore} />
                <ScorecardInfoTooltip helpKey="overallScore" />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  Riesgo:{" "}
                  <span className={TONE_TEXT[RISK_TONE[sc.riskLevel]]}>
                    {RISK_LABEL[sc.riskLevel]}
                  </span>
                  <ScorecardInfoTooltip helpKey="riskLevel" />
                </span>
                <span className="flex items-center gap-1 text-muted">
                  Confianza:{" "}
                  <span className="text-gray-200">{CONFIDENCE_LABEL[sc.confidenceLevel]}</span>
                  <ScorecardInfoTooltip helpKey="confidence" />
                </span>
              </div>
              <p className="text-xs leading-snug text-gray-300">{sc.summary}</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <ScoreCard label="Técnico" score={sc.technicalScore} helpKey="technicalScore"
                active={tab === "technical"} onClick={() => setTab("technical")} />
              <ScoreCard label="Fund." score={sc.fundamentalScore} helpKey="fundamentalScore"
                active={tab === "fundamentals"} onClick={() => setTab("fundamentals")} />
              <ScoreCard label="News" score={sc.newsScore} helpKey="newsScore"
                active={tab === "news"} onClick={() => setTab("news")} />
              <ScoreCard label="Sent." score={sc.sentimentScore} helpKey="sentimentScore"
                active={tab === "sentiment"} onClick={() => setTab("sentiment")} />
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex flex-wrap gap-1 border-b border-edge">
            {(["technical", "fundamentals", "news", "sentiment", "settings"] as Tab[]).map(
              (t) => (
                <button
                  key={t}
                  data-testid={`scorecard-tab-${t}`}
                  onClick={() => setTab(t)}
                  className={`rounded-t px-3 py-1 text-xs ${
                    tab === t
                      ? "bg-panel-3 font-semibold text-white"
                      : "text-muted hover:bg-panel-3/60"
                  }`}
                >
                  {t === "settings" ? "Ajustes" : SECTION_LABEL[t]}
                </button>
              )
            )}
          </div>

          <div className="mt-3">
            {tab === "settings" ? (
              <ScorecardSettings symbol={symbol} />
            ) : breakdown ? (
              <SectionView section={breakdown[tab]} which={tab} />
            ) : (
              <p className="p-3 text-xs text-muted">
                El desglose no está disponible. Refresca el scorecard.
              </p>
            )}
          </div>

          {sc.warnings.length > 0 && (
            <ul className="mt-3 space-y-0.5">
              {sc.warnings.map((w, i) => (
                <li key={i} className="text-[10px] text-amber-400">
                  ⚠ {w}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-center text-[10px] text-muted">
            Análisis informativo heurístico, no asesoría financiera.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Modal de la vista completa del scorecard del símbolo activo. */
export function StockScorecardFullView({
  symbol,
  onClose,
}: {
  symbol: string;
  onClose: () => void;
}) {
  const sc = useStockScorecardStore((s) => selectScorecard(s, symbol));
  if (!sc) return null;
  return createPortal(
    <FullViewBody sc={sc} symbol={symbol} onClose={onClose} />,
    document.body
  );
}
