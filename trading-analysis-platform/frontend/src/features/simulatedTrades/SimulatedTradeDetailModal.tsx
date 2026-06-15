import { useStockScorecardStore, selectScorecard } from "@/features/stockScorecard/stockScorecardStore";
import { OVERALL_VIEW_LABEL } from "@/features/stockScorecard/stockScorecardTypes";
import { useSimulatedTradesStore } from "./simulatedTradesStore";

/** Lee con seguridad un sub-objeto del snapshot (puede faltar o estar corrupto). */
function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="text-right text-xs font-medium text-gray-100">{value}</span>
    </div>
  );
}

function Delta({ from, to }: { from: number | null; to: number | null }) {
  if (from == null || to == null) return null;
  const d = to - from;
  if (d === 0) return <span className="text-muted"> (=)</span>;
  return (
    <span className={d > 0 ? "text-up" : "text-down"}>
      {" "}({d > 0 ? "+" : ""}{d.toFixed(0)})
    </span>
  );
}

/**
 * Detalle de una entrada simulada: muestra el SNAPSHOT de análisis tal como
 * estaba al crear la entrada y lo compara con el estado actual. Solo lectura.
 */
export function SimulatedTradeDetailModal() {
  const detail = useSimulatedTradesStore((s) => s.detail);
  const loading = useSimulatedTradesStore((s) => s.detailLoading);
  const close = useSimulatedTradesStore((s) => s.closeDetail);
  // Scorecard ACTUAL (si está cargado) para comparar contra el snapshot.
  const liveScorecard = useStockScorecardStore((s) =>
    selectScorecard(s, detail?.symbol ?? null)
  );

  if (!detail && !loading) return null;

  const snap = obj(detail?.analysisSnapshot);
  const meta = obj(detail?.metadata);
  const scSnap = obj(snap?.scorecard);
  const channel = obj(snap?.channelRiskReward);
  const tech = obj(snap?.technicalContext);
  const thesis = obj(snap?.simulatedEntryThesis);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        data-testid="sim-detail-modal"
        className="max-h-[90vh] w-[34rem] overflow-auto rounded-lg border border-edge bg-panel p-5"
      >
        {loading || !detail ? (
          <p className="text-sm text-muted">Cargando análisis…</p>
        ) : (
          <>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-100">
                  {detail.type} {detail.symbol} @ {detail.entryPrice.toFixed(2)}
                </h2>
                <p className="text-[11px] text-muted">
                  {detail.entryDate.slice(0, 10)} · {detail.daysSinceEntry} día(s)
                  {str(meta?.workspaceName) && ` · ${str(meta?.workspaceName)}`}
                  {detail.sourceTimeframe && ` · ${detail.sourceTimeframe}`}
                </p>
              </div>
              <button
                onClick={close}
                data-testid="sim-detail-close"
                className="rounded border border-edge bg-panel-2 px-2 py-0.5 text-xs text-gray-200 hover:bg-panel-3"
              >
                Cerrar
              </button>
            </div>

            {/* Rendimiento hipotético actual. */}
            <div className="mb-3 rounded border border-edge bg-panel-2 p-2">
              <Row label="Precio de entrada" value={detail.entryPrice.toFixed(2)} />
              <Row
                label={detail.status === "CERRADA" ? "Precio de salida" : "Precio actual"}
                value={detail.currentPrice != null ? detail.currentPrice.toFixed(2) : "n/d"}
              />
              <Row
                label="Rendimiento"
                value={
                  <span
                    className={(detail.gainLossPercent ?? 0) >= 0 ? "text-up" : "text-down"}
                  >
                    {detail.gainLossPercent != null
                      ? `${detail.gainLossPercent >= 0 ? "+" : ""}${detail.gainLossPercent.toFixed(2)}%`
                      : "n/d"}
                  </span>
                }
              />
            </div>

            {!snap && (
              <p
                data-testid="sim-detail-no-snapshot"
                className="rounded bg-panel-2 px-2 py-2 text-[11px] text-muted"
              >
                Esta entrada se creó sin snapshot de análisis.
              </p>
            )}

            {/* Tesis y escenarios. */}
            {thesis && (
              <Section title="Tesis y escenarios" testid="sim-detail-thesis">
                {str(thesis.scenario) && <Row label="Tesis" value={str(thesis.scenario)} />}
                {str(thesis.bullishCase) && <Row label="Alcista" value={str(thesis.bullishCase)} />}
                {str(thesis.bearishCase) && <Row label="Bajista" value={str(thesis.bearishCase)} />}
                {thesis.invalidation != null && (
                  <Row label="Invalidación" value={String(thesis.invalidation)} />
                )}
                {thesis.targetArea != null && (
                  <Row label="Objetivo" value={String(thesis.targetArea)} />
                )}
              </Section>
            )}

            {/* Scorecard: snapshot vs actual. */}
            {scSnap && (
              <Section title="Scorecard al crear (vs. actual)" testid="sim-detail-scorecard">
                <Row
                  label="General"
                  value={
                    <>
                      {num(scSnap.overallScore) ?? "n/d"}
                      <Delta from={num(scSnap.overallScore)} to={liveScorecard?.overallScore ?? null} />
                      {str(scSnap.overallView) && OVERALL_VIEW_LABEL[scSnap.overallView as keyof typeof OVERALL_VIEW_LABEL]
                        ? ` · ${OVERALL_VIEW_LABEL[scSnap.overallView as keyof typeof OVERALL_VIEW_LABEL]}`
                        : ""}
                    </>
                  }
                />
                <Row label="Técnico" value={<>{num(scSnap.technicalScore) ?? "n/d"}<Delta from={num(scSnap.technicalScore)} to={liveScorecard?.technicalScore ?? null} /></>} />
                <Row label="Fundamental" value={<>{num(scSnap.fundamentalScore) ?? "n/d"}<Delta from={num(scSnap.fundamentalScore)} to={liveScorecard?.fundamentalScore ?? null} /></>} />
                <Row label="Noticias" value={<>{num(scSnap.newsScore) ?? "n/d"}<Delta from={num(scSnap.newsScore)} to={liveScorecard?.newsScore ?? null} /></>} />
                <Row label="Sentimiento" value={<>{num(scSnap.sentimentScore) ?? "n/d"}<Delta from={num(scSnap.sentimentScore)} to={liveScorecard?.sentimentScore ?? null} /></>} />
                {str(scSnap.summary) && (
                  <p className="mt-1 text-[11px] text-gray-300">{str(scSnap.summary)}</p>
                )}
              </Section>
            )}

            {/* Channel R/R. */}
            {channel && num(channel.ratio) != null && (
              <Section title="Canal Riesgo/Recompensa al crear" testid="sim-detail-channel">
                <Row label="Ratio" value={`${num(channel.ratio)!.toFixed(2)} : 1`} />
                {num(channel.upperChannelPrice) != null && (
                  <Row label="Canal superior" value={num(channel.upperChannelPrice)!.toFixed(2)} />
                )}
                {num(channel.lowerChannelPrice) != null && (
                  <Row label="Canal inferior" value={num(channel.lowerChannelPrice)!.toFixed(2)} />
                )}
              </Section>
            )}

            {/* Valores técnicos guardados. */}
            {tech && Object.keys(tech).length > 0 && (
              <Section title="Indicadores al crear" testid="sim-detail-technical">
                {Object.entries(tech).map(([k, v]) => (
                  <Row key={k} label={k} value={String(v)} />
                ))}
              </Section>
            )}

            <p className="mt-3 text-[9px] text-muted">
              Snapshot hipotético (paper trading); no es asesoría financiera.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  testid,
  children,
}: {
  title: string;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <div data-testid={testid} className="mb-3 rounded border border-edge bg-panel-2 p-2">
      <p className="mb-1 text-[10px] font-semibold uppercase text-muted">{title}</p>
      {children}
    </div>
  );
}
