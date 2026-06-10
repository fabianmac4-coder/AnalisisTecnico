import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { DrawingToolbar } from "@/features/drawings/DrawingToolbar";
import { ChartGrid } from "@/features/charting/ChartGrid";
import { useLayoutStore } from "@/stores/layoutStore";

/**
 * Estructura general: header + sidebar + toolbar de dibujo + dashboard de seis
 * graficas. El dashboard es el unico espacio de trabajo (sin vista Resumen).
 */
export function AppShell() {
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <div className="flex min-h-0 flex-1">
        {!sidebarCollapsed && <Sidebar />}
        <DrawingToolbar />
        <main className="min-w-0 flex-1 overflow-hidden">
          <ChartGrid />
        </main>
      </div>
    </div>
  );
}
