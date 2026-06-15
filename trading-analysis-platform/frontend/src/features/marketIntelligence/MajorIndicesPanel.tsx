import { MajorIndexCard } from "./MajorIndexCard";
import type { MarketIndexDto } from "./marketIntelligenceTypes";

/** Grid de tarjetas de índices principales. */
export function MajorIndicesPanel({ indices }: { indices: MarketIndexDto[] }) {
  return (
    <section data-testid="major-indices-panel">
      <h2 className="mb-2 text-sm font-bold text-gray-100">Índices principales</h2>
      {indices.length === 0 ? (
        <p className="rounded border border-edge bg-panel-2 px-3 py-3 text-xs text-muted">
          Datos de índices no disponibles ahora mismo.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {indices.map((idx) => (
            <MajorIndexCard key={idx.symbol} index={idx} />
          ))}
        </div>
      )}
    </section>
  );
}
