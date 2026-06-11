import { useState } from "react";
import { useAiChatStore } from "./aiChatStore";
import type { AiConversation } from "./aiChatTypes";

/** Lista de conversaciones del simbolo activo: abrir, renombrar, borrar. */
export function AiChatConversationList({
  conversations,
  onClose,
}: {
  conversations: AiConversation[];
  onClose: () => void;
}) {
  const activeConversationId = useAiChatStore((s) => s.activeConversationId);
  const selectConversation = useAiChatStore((s) => s.selectConversation);
  const renameConversation = useAiChatStore((s) => s.renameConversation);
  const deleteConversation = useAiChatStore((s) => s.deleteConversation);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  return (
    <div className="border-b border-edge bg-panel-2/50 p-2" data-testid="ai-chat-conversations">
      {conversations.length === 0 && (
        <p className="px-1 py-2 text-[11px] text-muted">Sin conversaciones previas.</p>
      )}
      <ul className="max-h-44 space-y-1 overflow-y-auto">
        {conversations.map((c) => (
          <li key={c.id} className="flex items-center gap-1">
            {renamingId === c.id ? (
              <form
                className="flex flex-1 gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draftTitle.trim()) {
                    void renameConversation(c.id, draftTitle.trim());
                  }
                  setRenamingId(null);
                }}
              >
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  autoFocus
                  className="flex-1 rounded border border-edge bg-panel px-2 py-1 text-[11px] text-gray-100 focus:border-accent focus:outline-none"
                />
                <button type="submit" className="rounded bg-accent px-2 text-[11px] text-white">
                  ✓
                </button>
              </form>
            ) : (
              <>
                <button
                  onClick={() => {
                    void selectConversation(c.id);
                    onClose();
                  }}
                  className={`flex-1 truncate rounded px-2 py-1 text-left text-[11px] hover:bg-panel-3 ${
                    c.id === activeConversationId ? "bg-panel-3 text-gray-100" : "text-gray-300"
                  }`}
                  title={c.title ?? undefined}
                >
                  {c.title || `Conversación #${c.id}`}
                  <span className="ml-1 text-[10px] text-muted">
                    {c.updatedAt.slice(0, 10)}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setRenamingId(c.id);
                    setDraftTitle(c.title ?? "");
                  }}
                  title="Renombrar"
                  className="rounded px-1 text-[11px] text-muted hover:bg-panel-3"
                >
                  ✎
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("¿Eliminar esta conversación?")) {
                      void deleteConversation(c.id);
                    }
                  }}
                  title="Eliminar conversación"
                  className="rounded px-1 text-[11px] text-muted hover:bg-red-500/20 hover:text-red-400"
                >
                  🗑
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
