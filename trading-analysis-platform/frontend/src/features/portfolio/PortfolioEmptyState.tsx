/** Estado vacío: sin portafolios todavía. */
export function PortfolioEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      data-testid="portfolio-empty"
      className="mx-auto mt-16 max-w-md rounded-lg border border-edge bg-panel p-8 text-center"
    >
      <p className="text-2xl">📊</p>
      <h2 className="mt-2 text-sm font-bold text-gray-100">Crea tu primer portafolio</h2>
      <p className="mt-1 text-xs text-muted">
        Un portafolio te permite seguir tus posiciones, valor actual, ganancia/pérdida,
        asignación y riesgo de concentración. Es independiente de tu watchlist.
      </p>
      <button
        onClick={onCreate}
        data-testid="portfolio-create-empty"
        className="mt-4 rounded bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
      >
        ＋ Crear portafolio
      </button>
      <p className="mt-3 text-[10px] text-muted">
        Análisis informativo; no es asesoría financiera.
      </p>
    </div>
  );
}
