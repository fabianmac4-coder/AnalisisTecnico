import { useChartStore } from "@/stores/chartStore";
import { useAiChatStore } from "@/features/aiChat/aiChatStore";
import { useChatGptIframeStore } from "./chatGptIframeStore";

/**
 * Boton del header que abre el modo ChatGPT (iframe/helper) para el ticker
 * activo. Cierra el AI Chat nativo si estaba abierto (un panel a la vez).
 */
export function ChatGptIframeButton() {
  const activeSymbol = useChartStore((s) => s.activeSymbol);
  const isOpen = useChatGptIframeStore((s) => s.isOpen);
  const openPanel = useChatGptIframeStore((s) => s.openPanel);
  const closePanel = useChatGptIframeStore((s) => s.closePanel);

  const onClick = () => {
    if (isOpen) {
      closePanel();
      return;
    }
    if (!activeSymbol) return;
    useAiChatStore.getState().closeChat();
    void openPanel(activeSymbol);
  };

  return (
    <button
      onClick={onClick}
      disabled={!activeSymbol && !isOpen}
      data-testid="chatgpt-button"
      title={
        activeSymbol
          ? `ChatGPT con tu sesión del navegador (prompt de ${activeSymbol}; no guarda historial aquí)`
          : "Selecciona un ticker primero"
      }
      className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3 disabled:opacity-40"
    >
      🤖 ChatGPT
    </button>
  );
}
