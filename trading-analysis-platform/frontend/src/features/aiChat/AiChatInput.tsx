import { useState } from "react";

/** Entrada del chat: Enter envía, Shift+Enter hace salto de línea. */
export function AiChatInput({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (message: string) => void;
}) {
  const [text, setText] = useState("");

  const send = () => {
    const message = text.trim();
    if (!message || disabled) return;
    onSend(message);
    setText("");
  };

  return (
    <div className="border-t border-edge p-2">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Pregunta sobre este instrumento…"
          data-testid="ai-chat-input"
          className="max-h-32 min-h-[2.5rem] flex-1 resize-y rounded border border-edge bg-panel-2 px-3 py-2 text-xs text-gray-100 placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          onClick={send}
          disabled={disabled || !text.trim()}
          data-testid="ai-chat-send"
          title="Enviar (Enter)"
          className="rounded bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
