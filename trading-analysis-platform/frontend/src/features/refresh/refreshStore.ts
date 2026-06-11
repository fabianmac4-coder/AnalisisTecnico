// Estado del refresh manual + auto-refresh. UNA sola via de recarga:
// refreshNow -> chartStore.refreshAllPresets (forceRefresh al backend) +
// rendimiento de entradas simuladas. Nunca llama a Yahoo directamente.

import { create } from "zustand";
import { useChartStore } from "@/stores/chartStore";
import { useSimulatedTradesStore } from "@/features/simulatedTrades/simulatedTradesStore";
import { safeParseJson } from "@/utils/safeParseJson";
import {
  AUTO_REFRESH_OPTIONS,
  AUTO_REFRESH_STORAGE_KEY,
  type AutoRefreshInterval,
} from "./refreshTypes";

function readStoredInterval(): AutoRefreshInterval {
  try {
    const raw = localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
    if (!raw) return null;
    const value = safeParseJson<number | null>(raw, null);
    return (AUTO_REFRESH_OPTIONS as readonly number[]).includes(value as number)
      ? (value as AutoRefreshInterval)
      : null;
  } catch {
    return null;
  }
}

function writeStoredInterval(minutes: AutoRefreshInterval): void {
  try {
    if (minutes == null) localStorage.removeItem(AUTO_REFRESH_STORAGE_KEY);
    else localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, JSON.stringify(minutes));
  } catch {
    /* preferencia local, no critica */
  }
}

interface RefreshState {
  isRefreshing: boolean;
  lastRefreshedAt: string | null;
  autoRefreshIntervalMinutes: AutoRefreshInterval;
  /** true solo cuando hay un intervalo seleccionado. */
  autoRefreshEnabled: boolean;
  error: string | null;
  /** Aviso efimero ("Datos actualizados" / "Auto refresh activado..."). */
  notice: string | null;

  refreshNow: (symbol: string) => Promise<void>;
  setAutoRefreshInterval: (minutes: AutoRefreshInterval) => void;
  clearAutoRefresh: () => void;
  setNotice: (notice: string | null) => void;
}

let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let errorTimer: ReturnType<typeof setTimeout> | undefined;

export const useRefreshStore = create<RefreshState>((set, get) => ({
  isRefreshing: false,
  lastRefreshedAt: null,
  autoRefreshIntervalMinutes: readStoredInterval(),
  autoRefreshEnabled: readStoredInterval() != null,
  error: null,
  notice: null,

  async refreshNow(symbol) {
    // Deduplicacion: si ya hay un refresh en vuelo, no se solapa otro.
    if (get().isRefreshing || !symbol) return;
    set({ isRefreshing: true, error: null });
    try {
      const ok = await useChartStore.getState().refreshAllPresets(symbol);
      // Rendimiento de entradas simuladas con el precio fresco (no toca C050).
      if (import.meta.env.MODE !== "test") {
        void useSimulatedTradesStore.getState().load(symbol);
      }
      if (ok) {
        set({ lastRefreshedAt: new Date().toISOString() });
        get().setNotice("Datos de mercado actualizados");
      } else {
        _setEphemeralError(
          set,
          "No se pudieron actualizar los datos; se conservan los anteriores"
        );
      }
    } catch (err) {
      _setEphemeralError(
        set,
        (err as Error).message ||
          "No se pudieron actualizar los datos; se conservan los anteriores"
      );
    } finally {
      set({ isRefreshing: false });
    }
  },

  setAutoRefreshInterval(minutes) {
    // Radio-behavior: re-seleccionar el activo lo apaga.
    const next = get().autoRefreshIntervalMinutes === minutes ? null : minutes;
    writeStoredInterval(next);
    set({ autoRefreshIntervalMinutes: next, autoRefreshEnabled: next != null });
    get().setNotice(
      next == null ? "Auto refresh desactivado" : `Auto refresh activado: cada ${next} min`
    );
  },

  clearAutoRefresh() {
    writeStoredInterval(null);
    set({ autoRefreshIntervalMinutes: null, autoRefreshEnabled: false });
  },

  setNotice(notice) {
    if (noticeTimer) clearTimeout(noticeTimer);
    set({ notice });
    if (notice) {
      noticeTimer = setTimeout(() => set({ notice: null }), 3000);
    }
  },
}));

/** Error visible unos segundos (los datos viejos siguen en pantalla). */
function _setEphemeralError(
  set: (partial: Partial<RefreshState>) => void,
  message: string
): void {
  if (errorTimer) clearTimeout(errorTimer);
  set({ error: message });
  errorTimer = setTimeout(() => set({ error: null }), 5000);
}
