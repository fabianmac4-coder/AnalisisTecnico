import { useLayoutStore } from "@/stores/layoutStore";
import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { TIMEFRAME_PRESETS, type PresetKey } from "@/utils/timeframes";

// Etiquetas cortas para una barra compacta (no "4 años / Semanal").
const SHORT_LABEL: Record<PresetKey, string> = {
  "4Y_1W": "4Y W",
  "1Y_1D": "1Y D",
  "6M_1D": "6M D",
  "3M_1D": "3M D",
  "1M_1H": "1M H",
  "1W_30M": "1W 30M",
};

/**
 * Barra compacta de fuentes de dibujo: una pill por temporalidad de origen.
 * - Click en el cuerpo de la pill -> mostrar/ocultar (NO destructivo).
 * - Click en el punto de color -> color picker (sin alternar visibilidad).
 * - Click en la ✕ (sutil, hover rojo) -> borrar los dibujos de esa
 *   temporalidad, con confirmacion.
 */
export function DrawingFilterToolbar() {
  const filters = useLayoutStore((s) => s.drawingVisibilityFilters);
  const colors = useLayoutStore((s) => s.timeframeDrawingColors);
  const toggleTf = useLayoutStore((s) => s.toggleDrawingTimeframe);
  const setColor = useLayoutStore((s) => s.setTimeframeColor);
  const activeSymbol = useChartStore((s) => s.activeSymbol);
  const deleteByTimeframe = useDrawingStore((s) => s.deleteByTimeframe);

  const onDeleteTf = (tf: PresetKey) => {
    if (!activeSymbol) return;
    if (
      window.confirm(`¿Borrar todos los dibujos creados en ${SHORT_LABEL[tf]} para ${activeSymbol}?`)
    ) {
      void deleteByTimeframe(activeSymbol, tf);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-edge bg-panel px-3 py-1.5">
      <span className="mr-0.5 text-[11px] font-medium text-muted">Dibujos</span>

      {TIMEFRAME_PRESETS.map((p) => {
        const on = filters[p.key];
        return (
          <div
            key={p.key}
            onClick={() => toggleTf(p.key)}
            title={on ? "Ocultar dibujos de esta temporalidad" : "Mostrar"}
            className={[
              "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
              on
                ? "border-edge bg-panel-3 text-gray-100"
                : "border-transparent text-muted opacity-50 hover:opacity-80",
            ].join(" ")}
          >
            <label
              onClick={(e) => e.stopPropagation()}
              title="Cambiar color"
              className="relative flex h-3 w-3 cursor-pointer items-center justify-center"
            >
              <span
                className="h-2.5 w-2.5 rounded-full ring-1 ring-black/40"
                style={{ backgroundColor: colors[p.key] }}
              />
              <input
                type="color"
                value={colors[p.key]}
                onChange={(e) => setColor(p.key, e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <span>{SHORT_LABEL[p.key]}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTf(p.key);
              }}
              disabled={!activeSymbol}
              title={`Borrar dibujos de ${SHORT_LABEL[p.key]} (con confirmación)`}
              className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-muted transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
