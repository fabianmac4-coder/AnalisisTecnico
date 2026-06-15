import { RISK_COLOR, RISK_LABEL_ES, type MacroRiskLevel } from "./macroTypes";

/** Badge coloreado del nivel de riesgo macro. */
export function MacroRiskBadge({
  level,
  size = "sm",
}: {
  level: MacroRiskLevel;
  size?: "sm" | "lg";
}) {
  const color = RISK_COLOR[level];
  const padding = size === "lg" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      data-testid="macro-risk-badge"
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${padding}`}
      style={{ backgroundColor: `${color}22`, color }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {RISK_LABEL_ES[level]}
    </span>
  );
}
