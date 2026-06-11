import { useEffect, useRef } from "react";
import type { AiMessage } from "./aiChatTypes";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Lista de mensajes: usuario a la derecha, asistente a la izquierda. */
export function AiChatMessageList({
  messages,
  sending,
}: {
  messages: AiMessage[];
  sending: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Optional-call: jsdom (tests) no implementa scrollIntoView.
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages.length, sending]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-3" data-testid="ai-chat-messages">
      {messages.length === 0 && !sending && (
        <p className="mt-6 text-center text-xs text-muted">
          Pregunta sobre tendencia, soportes/resistencias, tus dibujos,
          indicadores o noticias del instrumento.
        </p>
      )}
      {messages.map((m) => (
        <div
          key={m.id}
          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
              m.role === "user"
                ? "bg-accent/20 text-gray-100"
                : "border border-edge bg-panel-2 text-gray-200"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.content}</p>
            <p className="mt-1 text-right text-[10px] text-muted">
              {formatTime(m.createdAt)}
            </p>
          </div>
        </div>
      ))}
      {sending && (
        <div className="flex justify-start">
          <div className="rounded-lg border border-edge bg-panel-2 px-3 py-2 text-xs text-muted">
            La IA está analizando…
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
