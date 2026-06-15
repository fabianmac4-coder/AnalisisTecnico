import { useEffect, useState } from "react";
import { useChartStore } from "@/stores/chartStore";
import { useAiChatStore } from "./aiChatStore";
import { AiChatConversationList } from "./AiChatConversationList";
import { AiChatInput } from "./AiChatInput";
import { AiChatMessageList } from "./AiChatMessageList";

/**
 * Drawer derecho del chat de IA, acotado al ticker activo.
 * No toca las graficas: solo LEE el simbolo activo. Si la IA falla, muestra
 * un error limpio y el dashboard sigue funcionando.
 */
export function AiChatPanel() {
  const isOpen = useAiChatStore((s) => s.isOpen);
  const closeChat = useAiChatStore((s) => s.closeChat);
  const chatSymbol = useAiChatStore((s) => s.activeSymbol);
  const setSymbol = useAiChatStore((s) => s.setSymbol);
  const conversations = useAiChatStore((s) =>
    chatSymbol ? s.conversationsBySymbol[chatSymbol] ?? [] : []
  );
  const activeConversationId = useAiChatStore((s) => s.activeConversationId);
  const messages = useAiChatStore((s) =>
    s.activeConversationId != null
      ? s.messagesByConversation[s.activeConversationId] ?? []
      : []
  );
  const createConversation = useAiChatStore((s) => s.createConversation);
  const sendMessage = useAiChatStore((s) => s.sendMessage);
  const sending = useAiChatStore((s) => s.sending);
  const error = useAiChatStore((s) => s.error);
  const includeChartContext = useAiChatStore((s) => s.includeChartContext);
  const includeDrawings = useAiChatStore((s) => s.includeDrawings);
  const includeIndicators = useAiChatStore((s) => s.includeIndicators);
  const includeNews = useAiChatStore((s) => s.includeNews);
  const setToggle = useAiChatStore((s) => s.setToggle);
  const prefillMessage = useAiChatStore((s) => s.prefillMessage);
  const consumePrefill = useAiChatStore((s) => s.consumePrefill);

  const activeSymbol = useChartStore((s) => s.activeSymbol);
  const [showConversations, setShowConversations] = useState(false);

  // Si cambia el ticker activo con el panel abierto, recarga ese simbolo.
  useEffect(() => {
    if (isOpen && activeSymbol && activeSymbol !== chatSymbol) {
      void setSymbol(activeSymbol);
    }
  }, [isOpen, activeSymbol, chatSymbol, setSymbol]);

  if (!isOpen) return null;

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  const toggles: Array<{
    key: "includeChartContext" | "includeDrawings" | "includeIndicators" | "includeNews";
    label: string;
    value: boolean;
  }> = [
    { key: "includeChartContext", label: "Gráfica", value: includeChartContext },
    { key: "includeDrawings", label: "Dibujos", value: includeDrawings },
    { key: "includeIndicators", label: "Indicadores", value: includeIndicators },
    { key: "includeNews", label: "Noticias", value: includeNews },
  ];

  return (
    <aside
      data-testid="ai-chat-panel"
      className="fixed bottom-0 right-0 top-[49px] z-40 flex w-full flex-col border-l border-edge bg-panel shadow-2xl sm:w-[420px]"
    >
      {/* Header del panel */}
      <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
        <span aria-hidden>✨</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-gray-100">
            AI Chat{" "}
            {chatSymbol && (
              <span className="rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[11px] text-accent">
                {chatSymbol}
              </span>
            )}
          </p>
          {activeConv && (
            <p className="truncate text-[10px] text-muted">
              {activeConv.title || `Conversación #${activeConv.id}`}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowConversations((v) => !v)}
          title="Conversaciones anteriores"
          data-testid="ai-chat-toggle-conversations"
          className="rounded border border-edge bg-panel-2 px-2 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
        >
          🗂 {conversations.length}
        </button>
        <button
          onClick={() => chatSymbol && void createConversation(chatSymbol)}
          title="Nueva conversación"
          data-testid="ai-chat-new-conversation"
          className="rounded border border-edge bg-panel-2 px-2 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
        >
          ＋
        </button>
        <button
          onClick={closeChat}
          title="Cerrar"
          data-testid="ai-chat-close"
          className="rounded px-2 py-1 text-sm text-muted hover:bg-panel-3 hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {showConversations && (
        <AiChatConversationList
          conversations={conversations}
          onClose={() => setShowConversations(false)}
        />
      )}

      {!chatSymbol ? (
        <p className="m-4 rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Primero busca y selecciona un ticker para chatear sobre él.
        </p>
      ) : activeConversationId == null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
          <p className="text-center text-xs text-muted">
            Aún no hay conversación para {chatSymbol}.
          </p>
          <button
            onClick={() => void createConversation(chatSymbol)}
            data-testid="ai-chat-start"
            className="rounded bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-blue-500"
          >
            Iniciar chat de IA para {chatSymbol}
          </button>
        </div>
      ) : (
        <>
          <AiChatMessageList messages={messages} sending={sending} />
          {error && (
            <p className="mx-3 mb-1 rounded bg-red-500/10 px-2 py-1.5 text-[11px] text-down">
              {error}
            </p>
          )}
          {/* Toggles de contexto */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-edge px-3 py-1.5">
            {toggles.map((t) => (
              <label
                key={t.key}
                className="flex items-center gap-1 text-[10px] text-muted"
              >
                <input
                  type="checkbox"
                  checked={t.value}
                  onChange={(e) => setToggle(t.key, e.target.checked)}
                  data-testid={`ai-toggle-${t.key}`}
                />
                {t.label}
              </label>
            ))}
          </div>
          <AiChatInput
            disabled={sending}
            onSend={(message) => void sendMessage(activeConversationId, message)}
            prefillMessage={prefillMessage}
            onConsumePrefill={consumePrefill}
          />
          <p className="px-3 pb-2 text-center text-[9px] text-muted">
            Análisis informativo generado por IA; no es asesoría financiera.
          </p>
        </>
      )}
    </aside>
  );
}
