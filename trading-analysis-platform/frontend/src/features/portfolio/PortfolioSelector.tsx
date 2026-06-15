import { usePortfolioStore } from "./portfolioStore";

/** Selector de portafolio + acciones (crear/editar/eliminar/predeterminar/refrescar). */
export function PortfolioSelector({ onCreate }: { onCreate: () => void }) {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activeId = usePortfolioStore((s) => s.activeId);
  const select = usePortfolioStore((s) => s.selectPortfolio);
  const update = usePortfolioStore((s) => s.updatePortfolio);
  const remove = usePortfolioStore((s) => s.deletePortfolio);
  const setDefault = usePortfolioStore((s) => s.setDefault);
  const loadAnalysis = usePortfolioStore((s) => s.loadAnalysis);
  const analysisLoading = usePortfolioStore((s) => s.analysisLoading);

  const active = portfolios.find((p) => p.c090Id === activeId);

  const onEdit = () => {
    if (!active) return;
    const name = window.prompt("Nuevo nombre del portafolio:", active.name);
    if (name && name.trim()) void update(active.c090Id, { name: name.trim() });
  };
  const onDelete = () => {
    if (!active) return;
    if (window.confirm(`¿Eliminar el portafolio "${active.name}"? (borrado suave)`)) {
      void remove(active.c090Id);
    }
  };

  const btn =
    "rounded border border-edge bg-panel-2 px-2.5 py-1 text-[11px] text-gray-200 hover:bg-panel-3 disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={activeId ?? ""}
        onChange={(e) => void select(Number(e.target.value))}
        data-testid="portfolio-select"
        className="rounded border border-edge bg-panel-2 px-2 py-1 text-xs text-gray-100"
      >
        {portfolios.map((p) => (
          <option key={p.c090Id} value={p.c090Id}>
            {p.name}
            {p.isDefault ? " ★" : ""}
          </option>
        ))}
      </select>
      <button onClick={onCreate} data-testid="portfolio-create" className={btn}>
        ＋ Crear
      </button>
      <button onClick={onEdit} disabled={!active} className={btn}>
        Editar
      </button>
      <button onClick={onDelete} disabled={!active} className={btn}>
        Eliminar
      </button>
      <button
        onClick={() => active && void setDefault(active.c090Id)}
        disabled={!active || active.isDefault}
        className={btn}
      >
        Predeterminar
      </button>
      <button
        onClick={() => void loadAnalysis(true)}
        disabled={!active || analysisLoading}
        data-testid="portfolio-refresh"
        className={btn}
      >
        {analysisLoading ? "Actualizando…" : "↻ Análisis"}
      </button>
    </div>
  );
}
