import {
  SENTIMENT_COLOR,
  SENTIMENT_LABEL_ES,
  type SentimentDto,
} from "./marketIntelligenceTypes";

const STATUS_COLOR: Record<string, string> = {
  POSITIVE: "text-up",
  NEGATIVE: "text-down",
  NEUTRAL: "text-muted",
};

/**
 * Gauge horizontal tipo Fear & Greed (proxy interno). Muestra el puntaje 0-100,
 * la etiqueta, confianza, fuente y el desglose por componente.
 */
export function FearGreedGauge({ sentiment }: { sentiment: SentimentDto }) {
  const { score, label, confidence, components } = sentiment;
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const color = SENTIMENT_COLOR[label] ?? "#6b7280";

  return (
    <div
      data-testid="fear-greed-gauge"
      className="rounded-lg border border-edge bg-panel p-4"
    >
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-100">
          Sentimiento de mercado
        </h2>
        <span className="rounded bg-panel-3 px-1.5 py-0.5 text-[9px] uppercase text-muted">
          Proxy Fear &amp; Greed
        </span>
      </div>

      {score == null ? (
        <p data-testid="sentiment-unavailable" className="py-4 text-xs text-muted">
          Los datos de sentimiento de mercado son limitados ahora mismo.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-end gap-3">
            <span
              data-testid="sentiment-score"
              className="text-3xl font-bold tabular-nums"
              style={{ color }}
            >
              {score}
            </span>
            <div className="pb-1">
              <span
                data-testid="sentiment-label"
                className="text-sm font-semibold"
                style={{ color }}
              >
                {SENTIMENT_LABEL_ES[label]}
              </span>
              <span className="ml-2 text-[10px] text-muted">
                Confianza: {confidence}
              </span>
            </div>
          </div>

          {/* Barra gradiente miedo -> codicia con marcador. */}
          <div className="relative mt-3 h-2.5 rounded-full bg-gradient-to-r from-down via-yellow-500 to-up">
            <div
              className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-white shadow"
              style={{ left: `calc(${pct}% - 2px)` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-muted">
            <span>Miedo</span>
            <span>Neutral</span>
            <span>Codicia</span>
          </div>

          {/* Desglose por componente. */}
          {components.length > 0 && (
            <ul className="mt-3 space-y-1" data-testid="sentiment-components">
              {components.map((c) => (
                <li
                  key={c.name}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="text-gray-300">{c.name}</span>
                  <span className="flex items-center gap-2">
                    {c.value != null && (
                      <span className="font-mono text-muted">{c.value}</span>
                    )}
                    <span className={`font-semibold ${STATUS_COLOR[c.status] ?? "text-muted"}`}>
                      {Math.round(c.score)}
                    </span>
                    <span className="text-[9px] text-muted">{c.source}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="mt-3 text-[9px] text-muted">
        Indicador de sentimiento (proxy). No debe usarse como señal única de
        compra o venta.
      </p>
    </div>
  );
}
