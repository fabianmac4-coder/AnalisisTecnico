import { MacroTrendBadge } from "./MacroTrendBadge";
import { MacroInfoTooltip } from "./MacroInfoTooltip";
import { STATUS_TEXT_COLOR, type MacroIndicator } from "./macroTypes";

const SOURCE_SHORT: Record<string, string> = {
  FRED: "FRED",
  "Yahoo Finance": "Yahoo",
  "FRED/Yahoo": "FRED/Yahoo",
};

/** Tarjeta de un dato macro: valor, tendencia, estado, fuente y explicación.
 * `helpKey` elige el texto del tooltip "?" (por defecto la clave del indicador). */
export function MacroDataCard({
  indicator,
  helpKey,
}: {
  indicator: MacroIndicator;
  helpKey?: string;
}) {
  const missing = indicator.status === "MISSING";
  const cp = indicator.changePercent;
  return (
    <div
      data-testid={`macro-card-${indicator.key}`}
      className={`rounded-lg border p-3 ${
        missing ? "border-edge/60 bg-panel-2/50" : "border-edge bg-panel-2"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold text-gray-200">{indicator.label}</p>
        <span className="flex shrink-0 items-center gap-1">
          {!missing && <MacroTrendBadge trend={indicator.trend} />}
          <MacroInfoTooltip helpKey={helpKey ?? indicator.key} />
        </span>
      </div>
      <p
        className={`mt-1 font-mono text-base font-semibold ${
          missing ? "text-muted" : STATUS_TEXT_COLOR[indicator.status]
        }`}
      >
        {indicator.displayValue}
      </p>
      {cp != null && (
        <p className={`text-[10px] font-mono ${cp >= 0 ? "text-up" : "text-down"}`}>
          {cp >= 0 ? "+" : ""}
          {cp.toFixed(2)}%
        </p>
      )}
      {indicator.explanation && (
        <p className="mt-1 text-[10px] leading-snug text-muted">{indicator.explanation}</p>
      )}
      <p className="mt-1 text-[9px] uppercase text-muted">
        {SOURCE_SHORT[indicator.source] ?? indicator.source}
      </p>
    </div>
  );
}
