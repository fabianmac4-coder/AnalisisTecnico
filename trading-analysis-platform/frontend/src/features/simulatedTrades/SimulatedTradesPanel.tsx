import { useEffect, useState } from "react";
import { useSymbolStore } from "@/stores/symbolStore";
import { useSimulatedTradesStore } from "./simulatedTradesStore";
import type { SimulatedTrade } from "./simulatedTradesTypes";

function pct(value: number | null): string {
  if (value == null) return "n/d";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/**
 * Panel de entradas simuladas del simbolo activo (sidebar).
 * Muestra rendimiento hipotetico (verde/rojo) y acciones por entrada.
 */
export function SimulatedTradesPanel() {
  const symbol = useSymbolStore((s) => s.activeSymbol);
  const trades = useSimulatedTradesStore((s) =>
    symbol ? s.tradesBySymbol[symbol] ?? [] : []
  );
  const load = useSimulatedTradesStore((s) => s.load);
  const openModal = useSimulatedTradesStore((s) => s.openModal);
  const closeTrade = useSimulatedTradesStore((s) => s.close);
  const removeTrade = useSimulatedTradesStore((s) => s.remove);
  const updateTrade = useSimulatedTradesStore((s) => s.update);
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    if (symbol && import.meta.env.MODE !== "test") void load(symbol);
  }, [symbol, load]);

  if (!symbol) return null;

  const visible = trades.filter((t) => showClosed || t.status === "ABIERTA");

  const onClose = (trade: SimulatedTrade) => {
    const raw = window.prompt(
      `Precio de salida para cerrar la entrada simulada de ${symbol}:`,
      trade.currentPrice != null ? trade.currentPrice.toFixed(2) : ""
    );
    if (raw == null) return;
    const exitPrice = Number(raw);
    if (!Number.isFinite(exitPrice) || exitPrice <= 0) return;
    const reason = window.prompt("Motivo de cierre (opcional):") ?? undefined;
    void closeTrade(symbol, trade.id, exitPrice, reason);
  };

  const onDelete = (trade: SimulatedTrade) => {
    if (window.confirm("¿Eliminar esta entrada simulada? (borrado suave)")) {
      void removeTrade(symbol, trade.id);
    }
  };

  return (
    <div data-testid="sim-trades-panel" className="border-t border-edge">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Entradas simuladas
        </span>
        <button
          onClick={openModal}
          data-testid="sim-entry-button"
          title="Marcar una entrada hipotética en este ticker (paper trading)"
          className="rounded border border-edge bg-panel-2 px-2 py-0.5 text-[11px] text-gray-200 hover:bg-panel-3"
        >
          ＋ Sim Entry
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="px-3 pb-2 text-[11px] text-muted">
          Sin entradas simuladas en {symbol}.
        </p>
      ) : (
        <ul className="space-y-1 px-2 pb-2">
          {visible.map((t) => {
            const positive = (t.gainLossPercent ?? 0) >= 0;
            return (
              <li
                key={t.id}
                data-testid={`sim-trade-${t.id}`}
                className="rounded border border-edge bg-panel-2 p-2 text-[11px]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-100">
                    {t.type} @ {t.entryPrice.toFixed(2)}
                    {t.status === "CERRADA" && (
                      <span className="ml-1 rounded bg-panel-3 px-1 text-[9px] text-muted">
                        CERRADA
                      </span>
                    )}
                  </span>
                  <span
                    className={`font-mono font-semibold ${positive ? "text-up" : "text-down"}`}
                  >
                    {pct(t.gainLossPercent)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-muted">
                  <span>
                    {t.entryDate.slice(0, 10)} · {t.daysSinceEntry} día(s)
                    {t.currentPrice != null && ` · ${t.status === "CERRADA" ? "salida" : "actual"} ${t.currentPrice.toFixed(2)}`}
                  </span>
                  {t.totalGainLossAmount != null && (
                    <span className={positive ? "text-up" : "text-down"}>
                      {t.totalGainLossAmount >= 0 ? "+" : ""}
                      {t.totalGainLossAmount.toFixed(2)}
                    </span>
                  )}
                </div>
                {t.name && <div className="mt-0.5 truncate text-gray-300">{t.name}</div>}
                {t.notes && <div className="truncate text-muted">{t.notes}</div>}
                <div className="mt-1 flex gap-1">
                  {t.status === "ABIERTA" && (
                    <>
                      <button
                        onClick={() => onClose(t)}
                        className="rounded bg-panel-3 px-1.5 py-0.5 hover:bg-edge"
                      >
                        Cerrar
                      </button>
                      <button
                        onClick={() =>
                          void updateTrade(symbol, t.id, { visible: !t.visible })
                        }
                        title="Mostrar/ocultar marcador en las gráficas"
                        className="rounded bg-panel-3 px-1.5 py-0.5 hover:bg-edge"
                      >
                        {t.visible ? "Ocultar" : "Mostrar"}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => onDelete(t)}
                    className="rounded bg-panel-3 px-1.5 py-0.5 text-red-400 hover:bg-red-500/20"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <label className="flex items-center gap-1.5 px-3 pb-2 text-[10px] text-muted">
        <input
          type="checkbox"
          checked={showClosed}
          onChange={(e) => setShowClosed(e.target.checked)}
        />
        Mostrar cerradas
      </label>
      <p className="px-3 pb-2 text-[9px] text-muted">
        Seguimiento hipotético (paper trading); no es asesoría financiera.
      </p>
    </div>
  );
}
