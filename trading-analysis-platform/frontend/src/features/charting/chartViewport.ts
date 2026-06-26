// Lógica PURA de preservación de viewport (zoom / rango lógico visible) de una
// gráfica. Lightweight Charts mide el "rango lógico" por ÍNDICE de barra, robusto
// cuando cambia la cantidad de velas (un refresh agrega velas). Sin estado ni DOM.

export interface LogicalRange {
  from: number;
  to: number;
}

/** Clave de viewport por workspace + acción + slot + temporalidad (range/interval). */
export function viewportKey(
  c030Id: number | undefined,
  symbol: string,
  slotId: string | undefined,
  sourceTimeframe: string
): string {
  return `${c030Id ?? "_"}:${symbol.toUpperCase()}:${slotId ?? "_"}:${sourceTimeframe}`;
}

export type ViewportAction =
  | { type: "restore"; range: LogicalRange }
  | { type: "fit" };

/**
 * Decide cómo posicionar la gráfica TRAS cargar/actualizar datos:
 * - Refresh (mismo dataset, no es el primer load) y hay rango vivo => conservar
 *   el rango ACTUAL (no resetear el zoom).
 * - Primer load o cambio de range/interval => restaurar el viewport GUARDADO de
 *   ese dataset si existe; si no, ajustar (fitContent).
 */
export function decideViewportAction(args: {
  isFirstLoad: boolean;
  keyChanged: boolean;
  liveRange: LogicalRange | null;
  savedRange: LogicalRange | null;
}): ViewportAction {
  const { isFirstLoad, keyChanged, liveRange, savedRange } = args;
  if (!isFirstLoad && !keyChanged && liveRange) {
    return { type: "restore", range: liveRange };
  }
  if (savedRange) return { type: "restore", range: savedRange };
  return { type: "fit" };
}

/**
 * Si el usuario estaba en el BORDE DERECHO (siguiendo las últimas velas), al
 * llegar datos nuevos se desplaza el rango para seguir el nuevo borde; si estaba
 * mirando histórico, se conserva el rango tal cual. `total` = velas + whitespace.
 */
export function adjustForNewData(
  range: LogicalRange | null,
  prevTotal: number,
  newTotal: number
): LogicalRange | null {
  if (!range) return null;
  const atRightEdge = range.to >= prevTotal - 1.5;
  if (atRightEdge && newTotal !== prevTotal) {
    const delta = newTotal - prevTotal;
    return { from: range.from + delta, to: range.to + delta };
  }
  return range;
}
