// Contenedor de toasts (esquina inferior derecha). Montar una vez en AppShell.
import { useToastStore } from "./toastStore";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div
      data-testid="toaster"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          role="status"
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto rounded-md border px-3 py-2 text-left text-xs shadow-lg ${
            t.type === "error"
              ? "border-red-700 bg-red-900/90 text-red-100"
              : t.type === "success"
                ? "border-emerald-700 bg-emerald-900/90 text-emerald-100"
                : "border-edge bg-panel-3 text-gray-100"
          }`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
