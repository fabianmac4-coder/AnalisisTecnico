import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useSymbolStore } from "@/stores/symbolStore";
import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { startIndicatorSync } from "@/features/indicators/indicatorSync";

export function App() {
  const hydrateCatalog = useSymbolStore((s) => s.hydrate);
  const hydrateChartTypes = useChartStore((s) => s.hydrateChartTypes);

  // Carga inicial desde SQL via API (App solo se monta con sesion iniciada).
  useEffect(() => {
    void hydrateCatalog();
    void hydrateChartTypes();
    if (import.meta.env.MODE !== "test") void startIndicatorSync();
  }, [hydrateCatalog, hydrateChartTypes]);

  // Tecla Suprimir / Backspace elimina el dibujo seleccionado (global).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement | null;
      // No interferir si el foco esta en un input/textarea.
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const { selectedDrawingId, removeDrawing } = useDrawingStore.getState();
      if (selectedDrawingId) {
        e.preventDefault();
        void removeDrawing(selectedDrawingId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <AppShell />;
}
