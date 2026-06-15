import { useNavigate } from "react-router-dom";
import { useSymbolStore } from "@/stores/symbolStore";
import { showToast } from "@/components/ui/toastStore";
import { usePortfolioStore } from "./portfolioStore";
import { money, pct, gainClass } from "./portfolioFormat";
import type { AnalysisPosition, PortfolioAnalysis, PortfolioPosition } from "./portfolioTypes";

/** Tabla de posiciones con cálculos por posición y acciones. */
export function PositionsTable({ analysis }: { analysis: PortfolioAnalysis }) {
  const navigate = useNavigate();
  const searchSymbol = useSymbolStore((s) => s.searchSymbol);
  const openModal = usePortfolioStore((s) => s.openPositionModal);
  const removePosition = usePortfolioStore((s) => s.deletePosition);
  const cur = analysis.portfolio.baseCurrency;

  const openDashboard = async (ticker: string) => {
    navigate("/");
    await searchSymbol(ticker);
  };

  // El modal de edición necesita los campos crudos de la posición.
  const toEditable = (p: AnalysisPosition): PortfolioPosition => ({
    c091Id: p.c091Id,
    c090Id: analysis.portfolio.c090Id,
    ticker: p.ticker,
    assetType: p.assetType ?? "STOCK",
    quantity: p.quantity,
    averageCost: p.averageCost,
    sector: p.sector,
    industry: p.industry,
    currency: p.currency,
  });

  const onDelete = (p: AnalysisPosition) => {
    if (window.confirm(`¿Eliminar la posición ${p.ticker}?`)) void removePosition(p.c091Id);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-edge bg-panel" data-testid="positions-table">
      <table className="w-full text-[11px]">
        <thead className="text-muted">
          <tr className="border-b border-edge">
            <th className="px-2 py-1.5 text-left">Ticker</th>
            <th className="px-2 py-1.5 text-right">Cant.</th>
            <th className="px-2 py-1.5 text-right">Costo prom.</th>
            <th className="px-2 py-1.5 text-right">Precio</th>
            <th className="px-2 py-1.5 text-right">Valor</th>
            <th className="px-2 py-1.5 text-right">P/L $</th>
            <th className="px-2 py-1.5 text-right">P/L %</th>
            <th className="px-2 py-1.5 text-right">Peso</th>
            <th className="px-2 py-1.5 text-left">Sector</th>
            <th className="px-2 py-1.5 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {analysis.positions.map((p) => (
            <tr key={p.c091Id} data-testid={`position-row-${p.c091Id}`} className="border-t border-edge hover:bg-panel-2">
              <td className="px-2 py-1.5">
                <button onClick={() => void openDashboard(p.ticker)} className="font-semibold text-accent hover:underline">
                  {p.ticker}
                </button>
                {p.companyName && <div className="max-w-36 truncate text-[9px] text-muted">{p.companyName}</div>}
              </td>
              <td className="px-2 py-1.5 text-right font-mono">{p.quantity}</td>
              <td className="px-2 py-1.5 text-right font-mono">{money(p.averageCost, cur)}</td>
              <td className="px-2 py-1.5 text-right font-mono">
                {p.currentPrice == null ? <span className="text-muted">n/d</span> : money(p.currentPrice, cur)}
              </td>
              <td className="px-2 py-1.5 text-right font-mono">{money(p.currentValue, cur)}</td>
              <td className={`px-2 py-1.5 text-right font-mono ${gainClass(p.gainLoss)}`}>{money(p.gainLoss, cur)}</td>
              <td className={`px-2 py-1.5 text-right font-mono ${gainClass(p.gainLossPercent)}`}>{pct(p.gainLossPercent)}</td>
              <td className="px-2 py-1.5 text-right font-mono">{p.portfolioWeight == null ? "n/d" : `${p.portfolioWeight.toFixed(1)}%`}</td>
              <td className="max-w-28 truncate px-2 py-1.5 text-gray-300">{p.sector ?? "—"}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right">
                <button onClick={() => openModal(toEditable(p))} className="rounded bg-panel-3 px-1.5 py-0.5 hover:bg-edge">Editar</button>{" "}
                <button
                  onClick={() => { void searchSymbol(p.ticker); showToast(`${p.ticker} agregado a tu watchlist`, "info"); }}
                  title="Agregar a watchlist"
                  className="rounded bg-panel-3 px-1.5 py-0.5 hover:bg-edge"
                >★</button>{" "}
                <button onClick={() => onDelete(p)} className="rounded bg-panel-3 px-1.5 py-0.5 text-red-400 hover:bg-red-500/20">Eliminar</button>
              </td>
            </tr>
          ))}
          {analysis.positions.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-6 text-center text-xs text-muted" data-testid="positions-empty">
                Este portafolio aún no tiene posiciones.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
