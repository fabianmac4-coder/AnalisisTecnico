import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useMacroStore } from "./macroStore";
import { MacroExecutiveSummary } from "./MacroExecutiveSummary";
import { UsaIndicatorsPanel } from "./UsaIndicatorsPanel";
import { InflationLaborPanel } from "./InflationLaborPanel";
import { RatesYieldCurvePanel } from "./RatesYieldCurvePanel";
import { GlobalMarketsPanel } from "./GlobalMarketsPanel";
import { EconomicCalendarPanel } from "./EconomicCalendarPanel";
import { MacroMeaningPanel } from "./MacroMeaningPanel";

/**
 * Macro Dashboard (Fase 3): entorno macroeconómico (tasas, inflación, empleo,
 * curva, mercados globales, calendario). Informativo; no es señal de compra/venta.
 */
export function MacroPage() {
  const overview = useMacroStore((s) => s.overview);
  const loading = useMacroStore((s) => s.loading);
  const error = useMacroStore((s) => s.error);
  const load = useMacroStore((s) => s.load);

  useEffect(() => {
    if (import.meta.env.MODE !== "test") void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#0d1017] p-6 text-gray-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold">Macro</h1>
            <p className="text-[11px] text-muted">
              Entorno macroeconómico: tasas, inflación, empleo, curva, mercados
              globales y calendario. Informativo, no es señal de compra/venta.
            </p>
          </div>
          <Link
            to="/"
            className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
          >
            ← Volver
          </Link>
        </div>

        {error && (
          <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-xs text-down">{error}</p>
        )}
        {overview?.warnings?.map((w, i) => (
          <p
            key={i}
            data-testid="macro-warning"
            className="mb-2 rounded bg-yellow-500/10 px-3 py-1.5 text-[11px] text-yellow-300"
          >
            {w}
          </p>
        ))}

        {loading && !overview ? (
          <div data-testid="macro-skeleton" className="space-y-3">
            <div className="h-28 animate-pulse rounded-lg bg-panel-2" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-panel-2" />
              ))}
            </div>
          </div>
        ) : !overview ? (
          <p className="text-sm text-muted">Sin datos macro por ahora.</p>
        ) : (
          <div className="space-y-4">
            <MacroExecutiveSummary
              summary={overview.executiveSummary}
              risk={overview.macroRisk}
              lastUpdated={overview.lastUpdated}
              fromCache={overview.fromCache}
            />
            <InflationLaborPanel indicators={overview.usaIndicators} />
            <UsaIndicatorsPanel indicators={overview.usaIndicators} />
            <RatesYieldCurvePanel rates={overview.rates} />
            <GlobalMarketsPanel globalMarkets={overview.globalMarkets} />
            {overview.economicCalendarAvailable && overview.economicCalendar.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <EconomicCalendarPanel
                  events={overview.economicCalendar}
                  source={overview.economicCalendarSource}
                />
                <MacroMeaningPanel bullets={overview.whatThisMeans} />
              </div>
            ) : (
              // Sin datos útiles de calendario: NO mostramos un panel vacío
              // (el aviso ya aparece en las advertencias de la página).
              <MacroMeaningPanel bullets={overview.whatThisMeans} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
