import type { AllocationSlice, PortfolioAnalysis } from "./portfolioTypes";

const BAR_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#eab308", "#ec4899"];

function AllocationGroup({ title, slices, testid }: { title: string; slices: AllocationSlice[]; testid: string }) {
  if (slices.length === 0) return null;
  return (
    <div data-testid={testid}>
      <p className="mb-1 text-[10px] font-semibold uppercase text-muted">{title}</p>
      <div className="space-y-1">
        {slices.slice(0, 8).map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-24 truncate text-[10px] text-gray-300" title={s.label}>{s.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-panel-3">
              <div className="h-full" style={{ width: `${s.weight ?? 0}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
            </div>
            <span className="w-12 text-right font-mono text-[10px] text-muted">{(s.weight ?? 0).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Asignación por posición, sector, tipo de activo y moneda (barras CSS). */
export function PortfolioAllocationCharts({ analysis }: { analysis: PortfolioAnalysis }) {
  const a = analysis.allocation;
  const alerts: string[] = [];
  const topPos = a.byPosition[0];
  if (topPos && (topPos.weight ?? 0) > 20) alerts.push(`${topPos.label} supera el 20% del portafolio.`);
  const topSector = a.bySector.find((s) => s.label !== "Desconocido");
  if (topSector && (topSector.weight ?? 0) > 40) alerts.push(`El sector ${topSector.label} supera el 40%.`);
  const top3 = a.byPosition.slice(0, 3).reduce((acc, s) => acc + (s.weight ?? 0), 0);
  if (top3 > 60) alerts.push("Las 3 mayores posiciones superan el 60%.");

  return (
    <section data-testid="allocation-panel" className="rounded-lg border border-edge bg-panel p-4">
      <h2 className="mb-2 text-sm font-bold text-gray-100">Asignación</h2>
      {alerts.length > 0 && (
        <div className="mb-2 space-y-0.5">
          {alerts.map((al, i) => (
            <p key={i} className="rounded bg-yellow-500/10 px-2 py-1 text-[10px] text-yellow-300">⚠ {al}</p>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <AllocationGroup title="Por posición" slices={a.byPosition} testid="alloc-by-position" />
        <AllocationGroup title="Por sector" slices={a.bySector} testid="alloc-by-sector" />
        <AllocationGroup title="Por tipo de activo" slices={a.byAssetType} testid="alloc-by-asset" />
        <AllocationGroup title="Por moneda" slices={a.byCurrency} testid="alloc-by-currency" />
      </div>
    </section>
  );
}
