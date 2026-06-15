import type { MacroTrend } from "./macroTypes";

const TREND: Record<MacroTrend, { icon: string; cls: string; label: string }> = {
  IMPROVING: { icon: "▲", cls: "text-up", label: "Mejora" },
  WORSENING: { icon: "▼", cls: "text-down", label: "Empeora" },
  STABLE: { icon: "▬", cls: "text-muted", label: "Estable" },
  UNKNOWN: { icon: "—", cls: "text-muted", label: "Sin datos" },
};

/** Badge de tendencia macro (mejora/empeora/estable). */
export function MacroTrendBadge({ trend }: { trend: MacroTrend }) {
  const tr = TREND[trend];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${tr.cls}`}>
      <span aria-hidden>{tr.icon}</span>
      {tr.label}
    </span>
  );
}
