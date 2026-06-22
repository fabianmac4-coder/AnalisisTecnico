import { useEffect, useState } from "react";
import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import {
  useChartWorkspaceStore,
  selectActiveWorkspace,
} from "@/features/charts/chartWorkspaceStore";
import { ChartPanel } from "./ChartPanel";
import { ChartToolbar } from "./ChartToolbar";
import { ExpandedChartModal } from "./ExpandedChartModal";
import { WorkspaceTabBar } from "@/features/charts/WorkspaceTabBar";
import { DrawingFilterToolbar } from "@/features/drawings/DrawingFilterToolbar";
import { IndicatorToolbar } from "@/features/indicators/IndicatorToolbar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/** Dashboard 3x2 de los seis slots del workspace activo del simbolo. */
export function ChartGrid() {
  const activeSymbol = useChartStore((s) => s.activeSymbol);
  const loadWorkspaceSlots = useChartStore((s) => s.loadWorkspaceSlots);
  const loadWorkspaces = useChartWorkspaceStore((s) => s.loadWorkspaces);
  const hasWorkspaces = useChartWorkspaceStore(
    (s) => (activeSymbol ? !!s.workspacesBySymbol[activeSymbol.toUpperCase()] : false)
  );
  const activeWorkspace = useChartWorkspaceStore((s) =>
    selectActiveWorkspace(s, activeSymbol)
  );
  const loadDrawings = useDrawingStore((s) => s.loadDrawings);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Garantiza que los workspaces del simbolo esten cargados (por si se llega
  // sin pasar por selectSymbol, p.ej. tras un refresh con simbolo activo).
  useEffect(() => {
    if (activeSymbol && !hasWorkspaces) void loadWorkspaces(activeSymbol);
  }, [activeSymbol, hasWorkspaces, loadWorkspaces]);

  // Carga los seis slots del workspace activo cuando cambia el simbolo o se
  // cambia de pestaña (c030Id). Editar un slot suelto NO recarga todo (lo hace
  // reloadSlot desde el propio panel).
  const c030Id = activeWorkspace?.c030Id;
  useEffect(() => {
    if (activeSymbol && activeWorkspace) {
      void loadWorkspaceSlots(activeSymbol, activeWorkspace.chartSlots);
      // Dibujos AISLADOS por workspace: al cambiar de pestaña se recargan los
      // del workspace activo (no se mezclan con los de otros workspaces).
      void loadDrawings(activeSymbol, activeWorkspace.c030Id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol, c030Id]);

  if (!activeSymbol) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted">
        <span className="text-4xl">📈</span>
        <p className="text-sm">Busca un ticker (ej. AAPL) para cargar sus gráficas.</p>
      </div>
    );
  }

  const slots = activeWorkspace?.chartSlots ?? [];
  const expandedSlot = slots.find((s) => s.slotId === expanded);

  return (
    <div className="flex h-full flex-col">
      <WorkspaceTabBar symbol={activeSymbol} />
      <ChartToolbar symbol={activeSymbol} />
      <DrawingFilterToolbar c030Id={activeWorkspace?.c030Id} slots={slots} />
      <IndicatorToolbar />
      <div className="grid flex-1 grid-cols-1 gap-2 overflow-auto p-2 md:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot, i) => (
          <div key={slot.slotId} className="min-h-[280px]">
            {/* Si un panel crashea, los otros siguen funcionando. */}
            <ErrorBoundary variant="panel" label={slot.slotId}>
              <ChartPanel
                slot={slot}
                symbol={activeSymbol}
                c030Id={activeWorkspace!.c030Id}
                workspaceName={activeWorkspace!.name}
                index={i}
                onExpand={setExpanded}
              />
            </ErrorBoundary>
          </div>
        ))}
      </div>

      {expandedSlot && activeWorkspace && (
        <ExpandedChartModal
          slot={expandedSlot}
          symbol={activeSymbol}
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  );
}
