// Sincroniza las configuraciones GLOBALES de indicadores con SQL (dbo.C020).
// El layoutStore (zustand persist) queda como cache local; el servidor es la
// fuente de verdad al iniciar sesion.

import { useLayoutStore } from "@/stores/layoutStore";
import { apiClient } from "@/services/apiClient";
import {
  normalizeIndicatorConfigs,
  type GlobalIndicatorConfig,
} from "./globalIndicators";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
let suppressPush = false;

async function pushToServer(indicators: GlobalIndicatorConfig[]): Promise<void> {
  try {
    await apiClient.put("/indicators", indicators);
  } catch (err) {
    console.warn("No se pudieron guardar los indicadores en el servidor", err);
  }
}

/**
 * Carga las configuraciones del servidor (si existen) y arranca el push
 * automatico (debounced) de los cambios. Llamar tras autenticarse.
 */
export async function startIndicatorSync(): Promise<void> {
  try {
    const rows = await apiClient.get<GlobalIndicatorConfig[]>("/indicators");
    if (rows.length > 0) {
      suppressPush = true;
      useLayoutStore.setState({ globalIndicators: normalizeIndicatorConfigs(rows) });
      suppressPush = false;
    } else {
      // Primer login: persiste los defaults actuales del usuario.
      void pushToServer(useLayoutStore.getState().globalIndicators);
    }
  } catch (err) {
    console.warn("No se pudieron cargar los indicadores del servidor", err);
  }

  if (unsubscribe) return; // ya suscrito
  let previous = useLayoutStore.getState().globalIndicators;
  unsubscribe = useLayoutStore.subscribe((state) => {
    if (state.globalIndicators === previous || suppressPush) {
      previous = state.globalIndicators;
      return;
    }
    previous = state.globalIndicators;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void pushToServer(previous), 800);
  });
}

export function stopIndicatorSync(): void {
  unsubscribe?.();
  unsubscribe = null;
  if (pushTimer) clearTimeout(pushTimer);
}
