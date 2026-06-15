import { useChatGptIframeStore } from "./chatGptIframeStore";
import { PROMPT_TYPE_LABELS, type ChatGptPromptType } from "./chatGptIframeTypes";

const TOGGLES: Array<{
  key:
    | "includePriceSummary"
    | "includeIndicators"
    | "includeDrawings"
    | "includeWatchlistNotes"
    | "includeFavoriteStatus"
    | "includeTimeframeSummary"
    | "includeScorecard"
    | "includeScorecardMetrics"
    | "includeMarketIntelligence"
    | "includeMacro"
    | "includePortfolio";
  label: string;
}> = [
  { key: "includePriceSummary", label: "Precio" },
  { key: "includeIndicators", label: "Indicadores" },
  { key: "includeDrawings", label: "Dibujos" },
  { key: "includeWatchlistNotes", label: "Notas" },
  { key: "includeFavoriteStatus", label: "Favorito" },
  { key: "includeTimeframeSummary", label: "Temporalidades" },
  { key: "includeScorecard", label: "Stock Scorecard" },
  { key: "includeScorecardMetrics", label: "Métricas detalladas" },
  { key: "includeMarketIntelligence", label: "Inteligencia de Mercado" },
  { key: "includeMacro", label: "Macro" },
  { key: "includePortfolio", label: "Portafolio" },
];

/**
 * Seccion de generacion de prompt. El PREVIEW es el protagonista del panel:
 * ocupa todo el alto disponible (flex-1); los controles van compactos arriba.
 */
export function ChatGptPromptBuilder() {
  const store = useChatGptIframeStore();

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      {/* Controles compactos: tipo + regenerar + toggles en una franja. */}
      <div className="mb-1.5 flex items-center gap-2">
        <select
          value={store.activePromptType}
          onChange={(e) => store.setPromptType(e.target.value as ChatGptPromptType)}
          data-testid="chatgpt-prompt-type"
          className="flex-1 rounded border border-edge bg-panel-2 px-2 py-1 text-[11px] text-gray-100 focus:border-accent focus:outline-none"
        >
          {Object.entries(PROMPT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          onClick={() => store.activeSymbol && void store.regeneratePrompt(store.activeSymbol)}
          disabled={store.loadingContext || !store.activeSymbol}
          data-testid="chatgpt-regenerate"
          title="Recargar el contexto del ticker y regenerar"
          className="rounded border border-edge bg-panel-2 px-2.5 py-1 text-xs text-gray-200 hover:bg-panel-3 disabled:opacity-40"
        >
          ↻
        </button>
      </div>

      <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {TOGGLES.map((t) => (
          <label key={t.key} className="flex items-center gap-1 text-[10px] text-muted">
            <input
              type="checkbox"
              checked={store[t.key]}
              onChange={(e) => store.toggleContextOption(t.key, e.target.checked)}
              data-testid={`chatgpt-toggle-${t.key}`}
            />
            {t.label}
          </label>
        ))}
      </div>

      {/* Preview GRANDE: toda la altura restante del panel. */}
      <textarea
        readOnly
        value={store.loadingContext ? "Generando prompt…" : store.generatedPrompt}
        data-testid="chatgpt-prompt-preview"
        className="mb-2 min-h-0 w-full flex-1 resize-none rounded border border-edge bg-panel-2 p-2.5 font-mono text-[11px] leading-relaxed text-gray-200 focus:outline-none"
      />

      {store.error && (
        <p className="mb-2 rounded bg-red-500/10 px-2 py-1.5 text-[11px] text-down">
          {store.error}
        </p>
      )}
      {store.notice && (
        <p className="mb-2 rounded bg-green-500/10 px-2 py-1.5 text-[11px] text-up">
          {store.notice}
        </p>
      )}

      <button
        onClick={() => void store.copyPrompt()}
        disabled={!store.generatedPrompt || store.loadingContext}
        data-testid="chatgpt-copy-prompt"
        className="w-full rounded bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
      >
        📋 Copiar prompt
      </button>
    </div>
  );
}
