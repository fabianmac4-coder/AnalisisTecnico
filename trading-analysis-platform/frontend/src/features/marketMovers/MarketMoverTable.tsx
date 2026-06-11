import { useNavigate } from "react-router-dom";
import { useSymbolStore } from "@/stores/symbolStore";
import type { MarketMoverDto } from "./marketMoversTypes";

function fmt(value: number | null, digits = 2): string {
  return value == null ? "—" : value.toFixed(digits);
}

function fmtBig(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

/** Tabla de una lista de movers con acciones por fila. */
export function MarketMoverTable({
  items,
  onNotice,
}: {
  items: MarketMoverDto[];
  onNotice: (msg: string) => void;
}) {
  const navigate = useNavigate();
  const searchSymbol = useSymbolStore((s) => s.searchSymbol);
  const catalog = useSymbolStore((s) => s.catalog);

  const openChart = async (symbol: string) => {
    navigate("/");
    await searchSymbol(symbol); // agrega al catalogo, selecciona y carga charts
  };

  const addToWatchlist = async (symbol: string) => {
    if (catalog.some((c) => c.symbol === symbol)) {
      onNotice(`${symbol} ya está en tu watchlist`);
      return;
    }
    await searchSymbol(symbol);
    onNotice(`${symbol} agregado a tu watchlist`);
  };

  if (items.length === 0) {
    return <p className="p-4 text-sm text-muted">Sin datos por ahora.</p>;
  }

  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-panel-2 text-muted">
        <tr>
          <th className="px-2 py-1.5">#</th>
          <th className="px-2 py-1.5">Ticker</th>
          <th className="px-2 py-1.5">Nombre</th>
          <th className="px-2 py-1.5 text-right">Precio</th>
          <th className="px-2 py-1.5 text-right">Cambio %</th>
          <th className="px-2 py-1.5 text-right">Volumen</th>
          <th className="px-2 py-1.5 text-right">Market cap</th>
          <th className="px-2 py-1.5"></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const positive = (item.changePercent ?? 0) >= 0;
          return (
            <tr key={item.symbol} className="border-t border-edge hover:bg-panel-2">
              <td className="px-2 py-1.5 text-muted">{item.ranking ?? ""}</td>
              <td className="px-2 py-1.5">
                <button
                  onClick={() => void openChart(item.symbol)}
                  data-testid={`mover-open-${item.symbol}`}
                  title="Abrir en las gráficas"
                  className="font-semibold text-accent hover:underline"
                >
                  {item.symbol}
                </button>
              </td>
              <td className="max-w-44 truncate px-2 py-1.5 text-gray-300">
                {item.name ?? "—"}
              </td>
              <td className="px-2 py-1.5 text-right font-mono">{fmt(item.price)}</td>
              <td
                className={`px-2 py-1.5 text-right font-mono font-semibold ${
                  item.changePercent == null
                    ? "text-muted"
                    : positive
                      ? "text-up"
                      : "text-down"
                }`}
              >
                {item.changePercent == null
                  ? "—"
                  : `${positive ? "+" : ""}${item.changePercent.toFixed(2)}%`}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-muted">
                {fmtBig(item.volume)}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-muted">
                {fmtBig(item.marketCap)}
              </td>
              <td className="px-2 py-1.5">
                <button
                  onClick={() => void addToWatchlist(item.symbol)}
                  data-testid={`mover-watchlist-${item.symbol}`}
                  title="Agregar al watchlist"
                  className="rounded bg-panel-3 px-1.5 py-0.5 text-[11px] hover:bg-edge"
                >
                  ＋☆
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
