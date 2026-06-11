import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { DrawingToolbar } from "@/features/drawings/DrawingToolbar";
import { ChartGrid } from "@/features/charting/ChartGrid";
import { AiChatPanel } from "@/features/aiChat/AiChatPanel";
import { ChatGptIframePanel } from "@/features/chatgptIframe/ChatGptIframePanel";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useLayoutStore } from "@/stores/layoutStore";

/**
 * Estructura general: header + sidebar + toolbar de dibujo + dashboard de seis
 * graficas. El dashboard es el unico espacio de trabajo (sin vista Resumen).
 * El chat de IA es un drawer lateral: si falla, NUNCA tira las graficas.
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
      <ErrorBoundary variant="panel">
        <AiChatPanel />
      </ErrorBoundary>
      <ErrorBoundary variant="panel">
        <ChatGptIframePanel />
      </ErrorBoundary>
    </div>
  );
}
