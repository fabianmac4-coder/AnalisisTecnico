import { useChartStore } from "@/stores/chartStore";
import { useChatGptIframeStore } from "@/features/chatgptIframe/chatGptIframeStore";
import { useAiChatStore } from "./aiChatStore";

/**
 * Boton del header que abre el chat de IA NATIVO (API de OpenAI, historial
 * guardado en la plataforma). Cierra el panel ChatGPT si estaba abierto.
 */
export function AiChatButton() {
  const activeSymbol = useChartStore((s) => s.activeSymbol);
  const isOpen = useAiChatStore((s) => s.isOpen);
  const openChat = useAiChatStore((s) => s.openChat);
  const closeChat = useAiChatStore((s) => s.closeChat);

  const onClick = () => {
    if (isOpen) {
      closeChat();
      return;
    }
    if (!activeSymbol) return;
    useChatGptIframeStore.getState().closePanel();
    void openChat(activeSymbol);
  };

  return (
    <button
      onClick={onClick}
      disabled={!activeSymbol && !isOpen}
      data-testid="ai-chat-button"
      title={
        activeSymbol
          ? `Asistente integrado sobre ${activeSymbol} (guarda el historial en la plataforma)`
          : "Selecciona un ticker primero"
      }
      className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3 disabled:opacity-40"
    >
      ✨ AI Chat
    </button>
  );
}
