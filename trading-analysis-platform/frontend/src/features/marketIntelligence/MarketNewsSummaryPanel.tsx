import { Link } from "react-router-dom";
import type { MarketNewsSummaryItem } from "./marketIntelligenceTypes";

/** Resumen de titulares de mercado (reutiliza el módulo de noticias). */
export function MarketNewsSummaryPanel({ items }: { items: MarketNewsSummaryItem[] }) {
  return (
    <section
      data-testid="news-summary-panel"
      className="rounded-lg border border-edge bg-panel p-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-100">Titulares de mercado</h2>
        <Link
          to="/news"
          data-testid="open-news-link"
          className="rounded-full border border-edge bg-panel-2 px-2.5 py-0.5 text-[10px] text-gray-200 hover:bg-panel-3"
        >
          Abrir Noticias
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted">Resumen de noticias no disponible ahora mismo.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={it.id ?? i}>
              <a
                href={it.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`news-summary-${it.id ?? i}`}
                className="block rounded border border-edge bg-panel-2 p-2 transition-colors hover:border-accent/60 hover:bg-panel-3"
              >
                <p className="text-xs font-medium leading-snug text-gray-100">{it.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted">
                  {it.publisher && <span className="font-medium">{it.publisher}</span>}
                  {it.category && (
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-accent">
                      {it.category}
                    </span>
                  )}
                  {it.provider && (
                    <span className="rounded bg-panel-3 px-1.5 py-0.5">{it.provider}</span>
                  )}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
