import { useMacroStore } from "./macroStore";

/** Botón de refresco (forceRefresh) del overview macro. */
export function MacroRefreshButton() {
  const load = useMacroStore((s) => s.load);
  const loading = useMacroStore((s) => s.loading);
  return (
    <button
      onClick={() => void load(true)}
      disabled={loading}
      data-testid="macro-refresh"
      className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3 disabled:opacity-50"
    >
      {loading ? "Actualizando…" : "↻ Actualizar"}
    </button>
  );
}
