import { useNavigate, Link } from "react-router-dom";
import { useSymbolStore } from "@/stores/symbolStore";
import type { MarketMoversSummaryDto, MoverSummaryItem } from "./marketIntelligenceTypes";

function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

/** Resumen compacto de market movers (reutiliza el módulo existente). */
export function MarketMoversSummaryPanel({ summary }: { summary: MarketMoversSummaryDto }) {
  const navigate = useNavigate();
  const searchSymbol = useSymbolStore((s) => s.searchSymbol);

  const openChart = async (symbol: string) => {
    navigate("/");
    await searchSymbol(symbol);
  };

  const rows: Array<{ label: string; item: MoverSummaryItem | undefined }> = [
    { label: "Mayor subida", item: summary.topGainers[0] },
    { label: "Mayor caída", item: summary.topLosers[0] },
    { label: "Más activa", item: summary.mostActive[0] },
    { label: "Tendencia", item: summary.trending[0] },
  ];

  return (
    <section
      data-testid="movers-summary-panel"
      className="rounded-lg border border-edge bg-panel p-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-100">Market movers</h2>
        <Link
          to="/market-movers"
          data-testid="open-movers-link"
          className="rounded-full border border-edge bg-panel-2 px-2.5 py-0.5 text-[10px] text-gray-200 hover:bg-panel-3"
        >
          Abrir Movers
        </Link>
      </div>
      <ul className="space-y-1.5">
        {rows.map(({ label, item }) => (
          <li
            key={label}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="w-24 shrink-0 text-[10px] uppercase text-muted">{label}</span>
            {item ? (
              <>
                <button
                  onClick={() => void openChart(item.symbol)}
                  className="flex-1 truncate text-left font-semibold text-accent hover:underline"
                >
                  {item.symbol}
                  {item.name && <span className="ml-1 text-muted">· {item.name}</span>}
                </button>
                <span
                  className={`font-mono font-semibold ${
                    (item.changePercent ?? 0) >= 0 ? "text-up" : "text-down"
                  }`}
                >
                  {pct(item.changePercent)}
                </span>
              </>
            ) : (
              <span className="flex-1 text-muted">—</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
