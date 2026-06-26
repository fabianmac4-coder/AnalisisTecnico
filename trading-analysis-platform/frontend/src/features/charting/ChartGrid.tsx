import { useEffect, useMemo, useState } from "react";
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
import { useReplayStore } from "@/features/replay/replayStore";
import { useReplayPlayback } from "@/features/replay/useReplayPlayback";
import { intervalToMinutes } from "@/features/replay/replayUtils";
import { useDrawingClipboardKeys } from "@/features/drawings/drawingClipboard";

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

  // --- Modo Replay ---
  const slots = activeWorkspace?.chartSlots ?? [];
  // Temporalidad de REFERENCIA para los pasos del replay: la gráfica maximizada
  // si hay una; si no, la más fina (menor intervalo) para revelar vela a vela.
  const finestSlotId = useMemo(() => {
    if (slots.length === 0) return undefined;
    return [...slots].sort(
      (a, b) => intervalToMinutes(a.interval) - intervalToMinutes(b.interval)
    )[0].slotId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(slots.map((s) => `${s.slotId}:${s.interval}`))]);
  const referenceSlotId = expanded ?? finestSlotId;
  const referenceBars = useChartStore((s) =>
    referenceSlotId ? s.chartDataBySlot[referenceSlotId]?.bars : undefined
  );
  const referenceTimes = useMemo(
    () => (referenceBars ?? []).map((b) => b.time),
    [referenceBars]
  );
  // Temporizador ÚNICO de reproducción (evita timers duplicados).
  useReplayPlayback(referenceTimes);
  // Atajos Ctrl/Cmd+C / +V para copiar/pegar el dibujo seleccionado (una vez).
  useDrawingClipboardKeys(activeSymbol);

  // Replay acotado a la sesión del símbolo: al cambiar de acción se desactiva.
  useEffect(() => {
    const st = useReplayStore.getState();
    if (st.enabled && st.symbol !== activeSymbol) st.disable();
  }, [activeSymbol]);

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

  const expandedSlot = slots.find((s) => s.slotId === expanded);

  return (
    <div className="flex h-full flex-col">
      <WorkspaceTabBar symbol={activeSymbol} />
      <ChartToolbar symbol={activeSymbol} replayReferenceTimes={referenceTimes} />
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
          slots={slots}
          onSelectSlot={setExpanded}
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  );
}
