import { useEffect } from "react";
import { useChartStore } from "@/stores/chartStore";
import { ChatGptIframeFrame } from "./ChatGptIframeFrame";
import { ChatGptPromptBuilder } from "./ChatGptPromptBuilder";
import { useChatGptIframeStore } from "./chatGptIframeStore";

/**
 * Drawer derecho del modo ChatGPT (iframe/helper).
 * Genera prompts con el contexto del ticker activo; NO usa la API de OpenAI
 * y NO guarda nada en C110/C111. Conversación = sesión ChatGPT del usuario.
 */
export function ChatGptIframePanel() {
  const isOpen = useChatGptIframeStore((s) => s.isOpen);
  const closePanel = useChatGptIframeStore((s) => s.closePanel);
  const panelSymbol = useChatGptIframeStore((s) => s.activeSymbol);
  const regeneratePrompt = useChatGptIframeStore((s) => s.regeneratePrompt);
  const activeSymbol = useChartStore((s) => s.activeSymbol);

  // Si cambia el ticker activo con el panel abierto, regenerar para ese simbolo.
  useEffect(() => {
    if (isOpen && activeSymbol && activeSymbol !== panelSymbol) {
      void regeneratePrompt(activeSymbol);
    }
  }, [isOpen, activeSymbol, panelSymbol, regeneratePrompt]);

  if (!isOpen) return null;

  return (
    <aside
      data-testid="chatgpt-panel"
      className="fixed bottom-0 right-0 top-[49px] z-40 flex w-full flex-col border-l border-edge bg-panel shadow-2xl sm:w-[470px]"
    >
      <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
        <span aria-hidden>🤖</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-gray-100">
            ChatGPT{" "}
            {panelSymbol && (
              <span className="rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[11px] text-accent">
                {panelSymbol}
              </span>
            )}
          </p>
          <p className="truncate text-[10px] text-muted">
            Usa tu sesión de ChatGPT; el historial no se guarda en la plataforma.
          </p>
        </div>
        <button
          onClick={closePanel}
          title="Cerrar"
          data-testid="chatgpt-close"
          className="rounded px-2 py-1 text-sm text-muted hover:bg-panel-3 hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {!panelSymbol ? (
        <p className="m-4 rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Primero busca y selecciona un ticker.
        </p>
      ) : (
        <>
          <ChatGptPromptBuilder />
          <ChatGptIframeFrame />
        </>
      )}
    </aside>
  );
}
