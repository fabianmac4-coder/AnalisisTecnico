import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useMacroStore } from "./macroStore";
import { MacroRiskBadge } from "./MacroRiskBadge";

/**
 * Tarjeta compacta de riesgo macro para la página de Inteligencia de Mercado
 * (integración ligera Fase 2 ↔ Fase 3). Carga el overview macro bajo demanda y,
 * si no está disponible, no renderiza nada (nunca rompe la otra página).
 */
export function MacroRiskMiniCard() {
  const overview = useMacroStore((s) => s.overview);
  const loading = useMacroStore((s) => s.loading);
  const load = useMacroStore((s) => s.load);

  useEffect(() => {
    if (!overview && !loading && import.meta.env.MODE !== "test") void load();
  }, [overview, loading, load]);

  if (!overview) return null;
  const ex = overview.executiveSummary;

  return (
    <Link
      to="/macro"
      data-testid="macro-risk-mini-card"
      className="block rounded-lg border border-edge bg-panel p-3 transition-colors hover:border-accent/60"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-gray-200">Riesgo macro</span>
        <MacroRiskBadge level={ex.riskLevel} />
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] text-muted">{ex.summary}</p>
      <span className="mt-1 inline-block text-[10px] text-accent">Abrir Macro →</span>
    </Link>
  );
}
