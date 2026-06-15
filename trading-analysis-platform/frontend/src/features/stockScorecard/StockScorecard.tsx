// Executive Stock Scorecard (Fase 1): tarjeta compacta del símbolo activo en la
// sidebar. Resume técnico/fundamental/noticias/sentimiento con riesgo, confianza
// y un resumen en español. Expandible, refrescable, copiable y con "Pregúntale a
// la IA". NO es asesoría financiera.
import { useEffect, useState } from "react";
import { useSymbolStore } from "@/stores/symbolStore";
import { useAiChatStore } from "@/features/aiChat/aiChatStore";
import { showToast } from "@/components/ui/toastStore";
import { Spinner } from "@/components/ui/Spinner";
import {
  useStockScorecardStore,
  selectScorecard,
} from "./stockScorecardStore";
import { StockScoreBadge } from "./StockScoreBadge";
import { StockScoreDetails } from "./StockScoreDetails";
import { StockScorecardFullView } from "./StockScorecardFullView";
import {
  CONFIDENCE_LABEL,
  RISK_LABEL,
  RISK_TONE,
  TONE_TEXT,
  buildScorecardExplainMessage,
  scoreTone,
  type StockScorecardResponse,
} from "./stockScorecardTypes";

function MiniScore({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="flex flex-col items-center rounded bg-panel-2 px-1 py-1" data-testid={`scorecard-mini-${label}`}>
      <span className={`font-mono text-sm font-bold ${TONE_TEXT[scoreTone(score)]}`}>
        {score === null ? "—" : score}
      </span>
      <span className="text-[9px] uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}

function ScorecardBody({ sc, symbol }: { sc: StockScorecardResponse; symbol: string }) {
  const expanded = useStockScorecardStore((s) => !!s.expandedBySymbol[symbol.toUpperCase()]);
  const toggleExpanded = useStockScorecardStore((s) => s.toggleExpanded);
  const load = useStockScorecardStore((s) => s.load);
  const loading = useStockScorecardStore((s) => !!s.loadingBySymbol[symbol.toUpperCase()]);
  const openWithPrefill = useAiChatStore((s) => s.openWithPrefill);
  const [showFull, setShowFull] = useState(false);

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(sc.summary);
      showToast("Resumen copiado", "success");
    } catch {
      showToast("No se pudo copiar el resumen", "error");
    }
  }

  return (
    <div className="space-y-2 px-3 py-2" data-testid="stock-scorecard">
      {sc.companyName && (
        <p className="truncate text-[11px] text-muted" title={sc.companyName}>
          {sc.companyName}
        </p>
      )}
      <StockScoreBadge view={sc.overallView} overallScore={sc.overallScore} />

      <div className="flex items-center gap-3 text-[11px]">
        <span>
          Riesgo: <span className={TONE_TEXT[RISK_TONE[sc.riskLevel]]}>{RISK_LABEL[sc.riskLevel]}</span>
        </span>
        <span className="text-muted">
          Confianza: <span className="text-gray-200">{CONFIDENCE_LABEL[sc.confidenceLevel]}</span>
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1">
        <MiniScore label="Téc" score={sc.technicalScore} />
        <MiniScore label="Fund" score={sc.fundamentalScore} />
        <MiniScore label="News" score={sc.newsScore} />
        <MiniScore label="Sent" score={sc.sentimentScore} />
      </div>

      <p className="text-[11px] leading-snug text-gray-300" data-testid="scorecard-summary">
        {sc.summary}
      </p>

      <div className="flex flex-wrap gap-1">
        <button
          data-testid="scorecard-open-full"
          onClick={() => setShowFull(true)}
          className="rounded bg-accent/80 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-accent"
        >
          Ver completo
        </button>
        <button
          data-testid="scorecard-toggle-details"
          onClick={() => toggleExpanded(symbol)}
          className="rounded bg-panel-3 px-2 py-0.5 text-[10px] text-gray-200 hover:bg-edge"
        >
          {expanded ? "Ocultar detalles" : "Ver detalles"}
        </button>
        <button
          data-testid="scorecard-refresh"
          onClick={() => void load(symbol, true)}
          disabled={loading}
          className="rounded bg-panel-3 px-2 py-0.5 text-[10px] text-gray-200 hover:bg-edge disabled:opacity-50"
        >
          ⟳ Refrescar
        </button>
        <button
          data-testid="scorecard-ask-ai"
          onClick={() => void openWithPrefill(symbol, buildScorecardExplainMessage(sc))}
          className="rounded bg-panel-3 px-2 py-0.5 text-[10px] text-accent hover:bg-edge"
        >
          ✨ Explícame con IA
        </button>
        <button
          data-testid="scorecard-copy"
          onClick={() => void copySummary()}
          className="rounded bg-panel-3 px-2 py-0.5 text-[10px] text-gray-200 hover:bg-edge"
        >
          ⧉ Copiar
        </button>
      </div>

      {expanded && <StockScoreDetails scorecard={sc} />}

      <p className="text-center text-[9px] text-muted">
        Análisis informativo, no asesoría financiera.
      </p>

      {showFull && (
        <StockScorecardFullView symbol={symbol} onClose={() => setShowFull(false)} />
      )}
    </div>
  );
}

/** Panel del Stock Scorecard para la sidebar del símbolo activo. */
export function StockScorecard() {
  const symbol = useSymbolStore((s) => s.activeSymbol);
  const load = useStockScorecardStore((s) => s.load);
  const sc = useStockScorecardStore((s) => selectScorecard(s, symbol));
  const loading = useStockScorecardStore((s) =>
    symbol ? !!s.loadingBySymbol[symbol.toUpperCase()] : false
  );
  const error = useStockScorecardStore((s) =>
    symbol ? s.errorBySymbol[symbol.toUpperCase()] : undefined
  );

  useEffect(() => {
    if (symbol && import.meta.env.MODE !== "test") void load(symbol);
  }, [symbol, load]);

  if (!symbol) return null;

  return (
    <section className="border-b border-edge">
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Stock Scorecard
        </h3>
        {loading && <Spinner size={14} />}
      </div>

      {sc ? (
        <ScorecardBody sc={sc} symbol={symbol} />
      ) : loading ? (
        <p className="px-3 pb-2 text-[11px] text-muted">Calculando scorecard…</p>
      ) : error ? (
        <div className="px-3 pb-2">
          <p className="text-[11px] text-down" data-testid="scorecard-error">
            Scorecard no disponible para este símbolo.
          </p>
          <button
            onClick={() => void load(symbol, true)}
            className="mt-1 rounded bg-panel-3 px-2 py-0.5 text-[10px] text-gray-200 hover:bg-edge"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <p className="px-3 pb-2 text-[11px] text-muted">Sin datos del scorecard.</p>
      )}
    </section>
  );
}
