import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import {
  RANGE_LABEL,
  INTERVAL_LABEL,
  type ChartSlotConfig,
} from "@/features/charts/chartWorkspaceTypes";
import {
  useDrawingStyleStore,
  defaultColorForSlot,
  DEFAULT_PANEL_STYLE,
} from "./drawingStyleStore";
import {
  useDrawingOriginVisibilityStore,
  originVisKey,
} from "./drawingOriginVisibilityStore";

interface Props {
  /** Workspace activo: el estilo se acota por `${c030Id}:${slotId}`. */
  c030Id?: number;
  /** Slots del workspace activo (Gráfica 1…N). */
  slots: ChartSlotConfig[];
}

/**
 * Gestión de dibujos por GRÁFICA DE ORIGEN. Los dibujos son del ANÁLISIS y se
 * replican en las seis gráficas; estos controles actúan GLOBAL (en las seis)
 * según la gráfica donde se CREÓ cada dibujo:
 * - Color: estilo de dibujos NUEVOS creados desde esa Gráfica.
 * - 👁 Mostrar/ocultar: oculta los dibujos creados desde esa Gráfica (sin borrar).
 * - ✕ Borrar: soft-delete de los dibujos creados desde esa Gráfica.
 */
export function DrawingFilterToolbar({ c030Id, slots }: Props) {
  const panelStyles = useDrawingStyleStore((s) => s.panelStyles);
  const setPanelStyle = useDrawingStyleStore((s) => s.setPanelStyle);
  const hidden = useDrawingOriginVisibilityStore((s) => s.hidden);
  const toggleOrigin = useDrawingOriginVisibilityStore((s) => s.toggle);
  const activeSymbol = useChartStore((s) => s.activeSymbol);
  const deleteByOriginSlot = useDrawingStore((s) => s.deleteByOriginSlot);

  if (slots.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-edge bg-panel px-3 py-1.5">
      <span className="mr-0.5 text-[11px] font-medium text-muted">Dibujos</span>

      {slots.map((slot, i) => {
        const key = `${c030Id ?? "_"}:${slot.slotId}`;
        const style = panelStyles[key] ?? {
          ...DEFAULT_PANEL_STYLE,
          color: defaultColorForSlot(slot.slotId),
        };
        const isHidden =
          !!activeSymbol && hidden[originVisKey(c030Id, activeSymbol, slot.slotId)] === true;
        const onToggle = () => {
          if (activeSymbol) toggleOrigin(c030Id, activeSymbol, slot.slotId);
        };
        const onDelete = () => {
          if (!activeSymbol) return;
          if (
            window.confirm(
              `¿Seguro que quieres borrar todos los dibujos creados desde Gráfica ${i + 1}?\n` +
                "Se eliminarán de todas las gráficas de este análisis."
            )
          ) {
            void deleteByOriginSlot(activeSymbol, slot.slotId);
          }
        };
        return (
          <div
            key={slot.slotId}
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px]",
              isHidden
                ? "border-transparent text-muted opacity-60"
                : "border-edge bg-panel-3 text-gray-100",
            ].join(" ")}
          >
            {/* Color de dibujos NUEVOS creados desde esta Gráfica. */}
            <label
              title="Color de dibujos nuevos creados desde esta gráfica"
              data-testid={`gfx-color-${slot.slotId}`}
              className="relative flex h-3.5 w-3.5 cursor-pointer items-center justify-center"
            >
              <span
                className="h-3 w-3 rounded-full ring-1 ring-black/40"
                style={{ backgroundColor: style.color }}
              />
              <input
                type="color"
                value={style.color}
                onChange={(e) => setPanelStyle(c030Id, slot.slotId, { color: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>

            <span className="font-medium" title={`${RANGE_LABEL[slot.range]} · ${INTERVAL_LABEL[slot.interval]}`}>
              Dibujos de Gráfica {i + 1}
            </span>

            {/* Mostrar/ocultar (por gráfica de origen, en las seis). */}
            <button
              onClick={onToggle}
              disabled={!activeSymbol}
              data-testid={`gfx-toggle-${slot.slotId}`}
              title={isHidden ? "Mostrar dibujos de esta gráfica" : "Ocultar dibujos de esta gráfica"}
              className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] hover:bg-panel-2 disabled:opacity-30"
            >
              {isHidden ? "🚫" : "👁"}
            </button>

            {/* Borrar (por gráfica de origen, con confirmación). */}
            <button
              onClick={onDelete}
              disabled={!activeSymbol}
              data-testid={`gfx-delete-${slot.slotId}`}
              title={`Borrar dibujos creados desde Gráfica ${i + 1} (con confirmación)`}
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
