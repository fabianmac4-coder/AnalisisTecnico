import { useChartStore } from "@/stores/chartStore";
import { useRefreshStore } from "./refreshStore";

/** Boton de refresh manual: recarga los datos del ticker activo. */
export function RefreshButton() {
  const activeSymbol = useChartStore((s) => s.activeSymbol);
  const isRefreshing = useRefreshStore((s) => s.isRefreshing);
  const refreshNow = useRefreshStore((s) => s.refreshNow);

  return (
    <button
      onClick={() => activeSymbol && void refreshNow(activeSymbol)}
      disabled={!activeSymbol || isRefreshing}
      data-testid="refresh-button"
      title="Actualizar datos de mercado"
      className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3 disabled:opacity-40"
    >
      <span className={isRefreshing ? "inline-block animate-spin" : undefined} aria-hidden>
        ⟳
      </span>
    </button>
  );
}
