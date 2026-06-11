import { SymbolCatalog } from "@/features/symbols/SymbolCatalog";
import { SimulatedTradesPanel } from "@/features/simulatedTrades/SimulatedTradesPanel";
import { SimulatedTradeModal } from "@/features/simulatedTrades/SimulatedTradeModal";
import { ChannelRiskRewardPanel } from "@/features/channelRiskReward/ChannelRiskRewardPanel";
import { SymbolNewsPanel } from "@/features/news/SymbolNewsPanel";

/**
 * Sidebar izquierda: watchlist + (para el simbolo activo) entradas simuladas
 * y analisis hipotetico de riesgo/beneficio por canal.
 */
export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-edge bg-panel">
      <div className="border-b border-edge px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Watchlist
      </div>
      <div className="flex-1 overflow-auto">
        <SymbolCatalog />
        <SymbolNewsPanel />
        <SimulatedTradesPanel />
        <ChannelRiskRewardPanel />
      </div>
      <SimulatedTradeModal />
    </aside>
  );
}
