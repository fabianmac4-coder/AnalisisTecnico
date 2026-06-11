// Hook del temporizador de auto-refresh. Montado UNA vez en App.
// - Sin intervalo o sin simbolo: no hay timer.
// - Tab oculta: se salta el tick (no se llama a Yahoo en background); al
//   volver a ser visible, refresca una vez si ya paso el intervalo completo.
// - Nunca se solapan refrescos (refreshNow ya deduplica por isRefreshing).

import { useEffect } from "react";
import { useRefreshStore } from "./refreshStore";

export function useAutoRefresh(symbol: string | null): void {
  const intervalMinutes = useRefreshStore((s) => s.autoRefreshIntervalMinutes);

  useEffect(() => {
    if (!symbol || intervalMinutes == null) return;

    const intervalMs = intervalMinutes * 60 * 1000;

    const tick = () => {
      const { isRefreshing, refreshNow } = useRefreshStore.getState();
      if (isRefreshing) return; // sin solapes
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return; // tab en background: no gastar llamadas a Yahoo
      }
      void refreshNow(symbol);
    };

    const timer = setInterval(tick, intervalMs);

    // Al volver a la tab: refresca una vez solo si ya paso el intervalo.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const { lastRefreshedAt, isRefreshing, refreshNow } = useRefreshStore.getState();
      const elapsed = lastRefreshedAt
        ? Date.now() - new Date(lastRefreshedAt).getTime()
        : Number.POSITIVE_INFINITY;
      if (!isRefreshing && elapsed >= intervalMs) void refreshNow(symbol);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Se reinicia al cambiar simbolo o intervalo; se limpia al desmontar.
  }, [symbol, intervalMinutes]);
}
