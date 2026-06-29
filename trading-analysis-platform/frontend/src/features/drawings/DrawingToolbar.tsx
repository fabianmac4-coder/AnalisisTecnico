import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { useDrawingStore } from "@/stores/drawingStore";
import { useChartStore } from "@/stores/chartStore";
import { useDrawingLabelStore } from "./drawingLabelStore";
import type { DrawingTool } from "./drawingTypes";

/** Icono de goma de borrar (trazo estilo lucide), inline para no sumar deps. */
function EraserIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Goma de borrar"
      role="img"
      data-testid="eraser-icon"
    >
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  );
}

const TOOLS: { tool: DrawingTool; label: string; icon: ReactNode }[] = [
  { tool: "cursor", label: "Cursor / seleccionar", icon: "⌖" },
  { tool: "free_line", label: "Línea libre (segmento A → B)", icon: "／" },
  { tool: "extended_trendline", label: "Trendline extendida (proyectada)", icon: "↗" },
  { tool: "dotted_line", label: "Línea punteada (segmento)", icon: "┄" },
  {
    tool: "horizontal",
    label: "Línea horizontal: clic A (nivel de precio) + clic B (largo); muestra el precio",
    icon: "─",
  },
  { tool: "rectangle", label: "Zona / rectángulo", icon: "▭" },
  { tool: "ellipse", label: "Elipse / círculo", icon: "◯" },
  {
    tool: "eraser",
    label: "Goma: mantén presionado y arrastra sobre los dibujos para borrarlos",
    icon: <EraserIcon />,
  },
];

// Herramientas de PLAN de posición (riesgo/beneficio). Separadas visualmente de
// las herramientas de dibujo y de las Entradas simuladas (C050).
const POSITION_TOOLS: { tool: DrawingTool; label: string; icon: ReactNode }[] = [
  {
    tool: "LONG_POSITION",
    label:
      "Plan de posición Long: planifica una compra con entrada, stop loss, objetivo y riesgo/beneficio (no es una entrada simulada)",
    icon: <span className="text-[11px] font-bold text-emerald-400">L▲</span>,
  },
  {
    tool: "SHORT_POSITION",
    label:
      "Plan de posición Short: planifica una venta en corto con entrada, stop loss, objetivo y riesgo/beneficio (no es una entrada simulada)",
    icon: <span className="text-[11px] font-bold text-rose-400">S▼</span>,
  },
];

/** Paleta vertical de herramientas de dibujo + acciones. */
export function DrawingToolbar() {
  const activeTool = useDrawingStore((s) => s.activeTool);
  const setActiveTool = useDrawingStore((s) => s.setActiveTool);
  const selectedDrawingId = useDrawingStore((s) => s.selectedDrawingId);
  const removeDrawing = useDrawingStore((s) => s.removeDrawing);
  const clearForSymbol = useDrawingStore((s) => s.clearForSymbol);
  const activeSymbol = useChartStore((s) => s.activeSymbol);
  const showPriceLabels = useDrawingLabelStore((s) => s.showPriceLabels);
  const togglePriceLabels = useDrawingLabelStore((s) => s.toggle);

  const onClear = () => {
    if (!activeSymbol) return;
    if (window.confirm(`¿Borrar todos los dibujos de ${activeSymbol}?`)) {
      void clearForSymbol(activeSymbol);
    }
  };

  return (
    <div className="flex w-12 flex-col items-center gap-1 border-r border-edge bg-panel py-2">
      {TOOLS.map((t) => (
        <IconButton
          key={t.tool}
          title={t.label}
          active={activeTool === t.tool}
          onClick={() => setActiveTool(t.tool)}
        >
          {t.icon}
        </IconButton>
      ))}

      <div className="my-1 h-px w-6 bg-edge" />

      {POSITION_TOOLS.map((t) => (
        <IconButton
          key={t.tool}
          title={t.label}
          active={activeTool === t.tool}
          onClick={() => {
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.debug("[PositionTool] toolbar selected", t.tool);
            }
            setActiveTool(t.tool);
          }}
        >
          {t.icon}
        </IconButton>
      ))}

      <div className="my-1 h-px w-6 bg-edge" />

      <IconButton
        title="Mostrar precios en líneas"
        active={showPriceLabels}
        onClick={togglePriceLabels}
      >
        <span data-testid="toggle-price-labels" className="text-[11px] font-bold">$</span>
      </IconButton>

      <IconButton
        title="Eliminar dibujo seleccionado (Supr)"
        disabled={!selectedDrawingId}
        onClick={() => selectedDrawingId && void removeDrawing(selectedDrawingId)}
      >
        🗑
      </IconButton>
      <IconButton
        title="Borrar todos los dibujos del ticker"
        disabled={!activeSymbol}
        onClick={onClear}
      >
        ⊘
      </IconButton>
    </div>
  );
}
