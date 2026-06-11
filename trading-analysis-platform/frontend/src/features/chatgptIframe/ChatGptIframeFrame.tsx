import { useEffect, useState } from "react";
import { useChatGptIframeStore } from "./chatGptIframeStore";
import {
  CHATGPT_FALLBACK_NEW_TAB,
  CHATGPT_IFRAME_ENABLED,
  CHATGPT_IFRAME_URL,
} from "./chatGptIframeTypes";

/**
 * Zona de "usar ChatGPT" del panel.
 *
 * chatgpt.com RECHAZA cargarse dentro de otras paginas (X-Frame-Options/CSP
 * de OpenAI; no se puede saltar). Por defecto mostramos la guia del flujo
 * copiar->abrir->pegar; el iframe solo se intenta si
 * VITE_ENABLE_CHATGPT_IFRAME=true (p.ej. para otra URL embebible).
 * NUNCA se lee ni inyecta nada en el iframe (cross-origin).
 */
export function ChatGptIframeFrame() {
  const copyPrompt = useChatGptIframeStore((s) => s.copyPrompt);
  const generatedPrompt = useChatGptIframeStore((s) => s.generatedPrompt);
  const [loaded, setLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  // Si en 5s el iframe no reporta carga, mostramos la ayuda de fallback.
  useEffect(() => {
    if (!CHATGPT_IFRAME_ENABLED) return;
    const timer = setTimeout(() => {
      if (!loaded) setShowFallback(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [loaded]);

  const openInNewTab = async () => {
    // Copia el prompt antes de abrir, para pegarlo directo en ChatGPT.
    await copyPrompt();
    window.open(CHATGPT_IFRAME_URL, "_blank", "noopener,noreferrer");
  };

  const openButton = CHATGPT_FALLBACK_NEW_TAB && (
    <button
      onClick={() => void openInNewTab()}
      disabled={!generatedPrompt}
      data-testid="chatgpt-open-new-tab"
      className="w-full rounded bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
    >
      🤖 Copiar prompt y abrir ChatGPT en pestaña nueva
    </button>
  );

  if (!CHATGPT_IFRAME_ENABLED) {
    // Footer COMPACTO: el espacio del panel es para el prompt, no para la guia.
    return (
      <div className="border-t border-edge px-3 py-2">
        {openButton}
        <details data-testid="chatgpt-iframe-fallback" className="mt-1.5">
          <summary className="cursor-pointer text-[10px] text-muted hover:text-gray-300">
            ¿Cómo se usa?
          </summary>
          <p className="mt-1 text-[10px] leading-relaxed text-muted">
            Copia el prompt y pégalo en ChatGPT. Como ChatGPT no permite
            cargarse dentro de otras páginas, se abre en una pestaña nueva con
            tu sesión. La plataforma no guarda esas conversaciones; para
            historial integrado usa ✨ AI Chat.
          </p>
        </details>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
            Cargando ChatGPT…
          </div>
        )}
        <iframe
          src={CHATGPT_IFRAME_URL}
          title="ChatGPT"
          onLoad={() => setLoaded(true)}
          className="h-full w-full border-0 bg-panel-2"
          allow="clipboard-read; clipboard-write; microphone"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <p
        data-testid="chatgpt-iframe-fallback"
        className={`border-t border-edge px-3 py-2 text-[11px] ${
          showFallback ? "bg-amber-500/10 text-amber-300" : "text-muted"
        }`}
      >
        Si ChatGPT no carga aquí dentro (lo bloquea OpenAI), ábrelo en una
        pestaña nueva y pega el prompt copiado.
      </p>

      <div className="flex items-center gap-2 border-t border-edge px-3 py-2">
        {openButton}
      </div>
    </div>
  );
}
