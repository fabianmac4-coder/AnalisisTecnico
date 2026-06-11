import { useCallback, useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { ChartInstance } from "@/features/charting/chartEngine/ChartEngineAdapter";
import { useDrawingStore } from "@/stores/drawingStore";
import type { PresetKey } from "@/utils/timeframes";
import {
  isTwoPointTool,
  type Drawing,
  type DrawingPoint,
  type TwoPointTool,
} from "./drawingTypes";
import { createDrawing } from "./createDrawing";
import {
  distancePointToSegment,
  drawingPointToLocalPoint,
  drawingPointToLocalPointRobust,
  localPointToDrawingPoint,
  pointerEventToLocalPoint,
  timeMsToCoordinateRobust,
  type FutureConversionInfo,
  type LocalPoint,
} from "./chartCoordinateUtils";
import {
  projectLineToVisibleRange,
  clipFreeLineSegmentToVisibleRange,
} from "./drawingProjection";
import { resolveDrawingColor, DEFAULT_TIMEFRAME_DRAWING_COLORS } from "./colors";

type MainSeries = ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area" | "Histogram">;
type VisibleRange = { startMs: number; endMs: number } | null;

interface Props {
  instance: ChartInstance | null;
  drawings: Drawing[];
  editable: boolean;
  symbol: string;
  sourceTimeframe: PresetKey;
  showTimeframeLabels?: boolean;
  /** Colores por temporalidad para resolver el color efectivo de cada dibujo. */
  timeframeColors?: Record<PresetKey, string>;
  /** Info del ultimo bar real para convertir clicks en el area futura. */
  futureInfo?: FutureConversionInfo | null;
  /**
   * Velas REALES de este panel (solo sus tiempos importan). Imprescindibles
   * para alinear dibujos de otras temporalidades: la x se interpola entre las
   * coordenadas reales de las velas vecinas, nunca sobre el ancho del overlay.
   */
  candles?: readonly { time: number }[];
}

// Maquina de estados generalizada para todas las herramientas de DOS puntos.
type Interaction =
  | { mode: "idle" }
  | { mode: "awaiting_first_point"; tool: TwoPointTool }
  | {
      mode: "awaiting_second_point";
      tool: TwoPointTool;
      firstPoint: DrawingPoint;
      previewPoint: DrawingPoint | null;
    };

const DRAW_COLOR = "#60a5fa";
const SELECT_COLOR = "#f59e0b";
const HIT_TOLERANCE = 8;
// Radio de agarre de los extremos (manijas) al editar con el cursor.
const HANDLE_RADIUS_PX = 10;
// Tipos cuyo EXTREMO se puede arrastrar individualmente (lineas).
const ENDPOINT_EDIT_TYPES = new Set(["free_line", "dotted_line", "extended_trendline"]);
// Radio del "pincel" de la goma. 6 px: comodo pero sin borrar lineas vecinas.
const DEFAULT_ERASER_RADIUS_PX = 6;
const DEV = import.meta.env.DEV;
// Panel visual de diagnostico (esquina inferior izquierda). Solo para depurar
// el sistema de dibujo: DEBE quedar en false; los console.debug siguen activos
// en desarrollo.
const SHOW_DRAWING_DEBUG_PANEL = false;

/** Diagnostico dev-only: por que un dibujo NO se pinto en este panel. */
function debugSkip(
  drawing: Drawing,
  reason: string,
  extra: Record<string, unknown> = {}
): void {
  if (!DEV) return;
  // eslint-disable-next-line no-console
  console.debug("[DrawingRenderSkip]", {
    drawingId: drawing.id,
    type: drawing.type,
    sourceTimeframe: drawing.sourceTimeframe,
    reason,
    drawingPoints: drawing.points,
    showOnAllTimeframes: drawing.showOnAllTimeframes,
    ...extra,
  });
}

export function DrawingLayer({
  instance,
  drawings,
  editable,
  symbol,
  sourceTimeframe,
  showTimeframeLabels = false,
  timeframeColors = DEFAULT_TIMEFRAME_DRAWING_COLORS,
  futureInfo = null,
  candles = [],
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const activeTool = useDrawingStore((s) => s.activeTool);
  const addDrawing = useDrawingStore((s) => s.addDrawing);
  const removeDrawing = useDrawingStore((s) => s.removeDrawing);
  const selectDrawing = useDrawingStore((s) => s.selectDrawing);
  const selectedDrawingId = useDrawingStore((s) => s.selectedDrawingId);

  const [interaction, setInteraction] = useState<Interaction>({ mode: "idle" });
  const interactionRef = useRef<Interaction>(interaction);
  interactionRef.current = interaction;

  // Estado del trazo de la goma: mientras se mantiene presionado, cada dibujo
  // tocado se borra UNA sola vez (Set por trazo).
  const isErasingRef = useRef(false);
  const erasedDuringStroke = useRef<Set<string>>(new Set());
  // Posicion del puntero para el circulo-preview de la goma.
  const [eraserPos, setEraserPos] = useState<LocalPoint | null>(null);

  // ---- Edicion (mover/ajustar) con el cursor ----
  // Arrastre en curso: cuerpo completo (conserva pendiente) o un extremo.
  const dragRef = useRef<
    | null
    | {
        drawingId: string;
        mode: "body" | "endpoint";
        endpointIndex: number;
        startDp: DrawingPoint;
        originalPoints: DrawingPoint[];
      }
  >(null);
  // Puntos "borrador" mientras se arrastra (solo render; se persiste al soltar).
  const [draft, setDraft] = useState<{ id: string; points: DrawingPoint[] } | null>(null);
  const updateDrawing = useDrawingStore((s) => s.updateDrawing);

  // Fuerza re-render del overlay cuando cambia el viewport (pan/zoom/resize).
  const [, setRenderVersion] = useState(0);
  const invalidate = useCallback(() => setRenderVersion((v) => v + 1), []);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [debug, setDebug] = useState<{ local?: LocalPoint; dp?: DrawingPoint | null }>({});

  // Referencias frescas al motor (evita series obsoletas tras cambiar el tipo).
  const chart = (instance?.getChartApi() ?? null) as IChartApi | null;
  const mainSeries = (instance?.getMainSeries() ?? null) as MainSeries | null;

  const isDrawingActive = editable && isTwoPointTool(activeTool);
  const isEraser = editable && activeTool === "eraser";
  const isCursor = editable && activeTool === "cursor";
  // Con el cursor y un dibujo seleccionado, el overlay captura punteros para
  // poder ARRASTRAR la linea o sus extremos (pan/zoom se pausa mientras).
  const isEditMode = isCursor && selectedDrawingId != null;
  // El overlay captura punteros al dibujar, al borrar y al editar.
  const overlayInteractive = isDrawingActive || isEraser || isEditMode;

  // Sincroniza la maquina de estados con la herramienta activa.
  useEffect(() => {
    setInteraction(
      isDrawingActive
        ? { mode: "awaiting_first_point", tool: activeTool as TwoPointTool }
        : { mode: "idle" }
    );
  }, [activeTool, isDrawingActive]);

  // Desactiva pan/zoom de la grafica mientras se dibuja/borra.
  useEffect(() => {
    if (!instance) return;
    instance.setInteractionEnabled(!overlayInteractive);
    return () => instance.setInteractionEnabled(true);
  }, [instance, overlayInteractive]);

  // Repinta el overlay en cambios de viewport y de tamaño.
  useEffect(() => {
    if (!instance) return;
    const unsub = instance.onViewportChange(invalidate);
    const el = svgRef.current;
    const ro = new ResizeObserver(() => {
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
      invalidate();
    });
    if (el) {
      ro.observe(el);
      setSize({ w: el.clientWidth, h: el.clientHeight });
    }
    return () => {
      unsub();
      ro.disconnect();
    };
  }, [instance, invalidate]);

  // Contexto de conversion tiempo->x: velas reales del panel + grid futuro.
  const convCtx: ConvCtx = { bars: candles, future: futureInfo };

  // Topmost-first: itera en orden de render inverso (el ultimo dibujado gana).
  const findHitDrawing = useCallback(
    (cursor: LocalPoint, tolerance: number = HIT_TOLERANCE): Drawing | null => {
      if (!instance) return null;
      const c = instance.getChartApi() as IChartApi;
      const s = instance.getMainSeries() as MainSeries;
      const range = instance.getVisibleTimeRangeMs();
      const ctx: ConvCtx = { bars: candles, future: futureInfo };
      for (let i = drawings.length - 1; i >= 0; i--) {
        const d = drawings[i];
        if (!d.visible) continue;
        if (hitTest(d, cursor, c, s, size, range, tolerance, ctx)) return d;
      }
      return null;
    },
    [instance, drawings, size, candles, futureInfo]
  );

  // Borra el dibujo superior bajo el puntero (una sola vez por trazo).
  const eraseAtPointer = useCallback(
    (local: LocalPoint) => {
      const hit = findHitDrawing(local, DEFAULT_ERASER_RADIUS_PX);
      if (hit && !erasedDuringStroke.current.has(hit.id)) {
        erasedDuringStroke.current.add(hit.id);
        void removeDrawing(hit.id);
      }
    },
    [findHitDrawing, removeDrawing]
  );

  // Seleccion (herramienta cursor): usa el click nativo de la grafica para no
  // bloquear el pan/zoom.
  useEffect(() => {
    if (!instance || !isCursor) return;
    return instance.onClick((x, y) => {
      const hit = findHitDrawing({ x, y });
      selectDrawing(hit ? hit.id : null);
    });
  }, [instance, isCursor, findHitDrawing, selectDrawing]);

  // Escape cancela el trazo en curso (dibujo o goma) y limpia la seleccion.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      isErasingRef.current = false;
      // Cancela el arrastre de edicion sin persistir.
      dragRef.current = null;
      setDraft(null);
      setInteraction((prev) =>
        prev.mode === "awaiting_second_point"
          ? { mode: "awaiting_first_point", tool: prev.tool }
          : prev
      );
      selectDrawing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectDrawing]);

  // ---- Creacion del dibujo ----
  const finalize = useCallback(
    async (tool: TwoPointTool, points: DrawingPoint[]) => {
      const drawing = createDrawing({
        symbol,
        sourceTimeframe,
        type: tool,
        points,
        // El color por defecto lo decide la temporalidad de origen.
        color: timeframeColors[sourceTimeframe] ?? DRAW_COLOR,
      });
      await addDrawing(drawing);
    },
    [symbol, sourceTimeframe, addDrawing, timeframeColors]
  );

  const localToDrawing = (e: React.PointerEvent): { local: LocalPoint; dp: DrawingPoint | null } => {
    const svg = svgRef.current;
    if (!svg || !chart || !mainSeries) return { local: { x: 0, y: 0 }, dp: null };
    const local = pointerEventToLocalPoint(e, svg);
    const dp = localPointToDrawingPoint(local, chart, mainSeries, futureInfo);
    return { local, dp };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!overlayInteractive) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* algunos navegadores pueden lanzar; no es critico */
    }

    // Goma: inicia el TRAZO. Mantener presionado y arrastrar va borrando todo
    // dibujo tocado (cada uno una sola vez por trazo).
    if (isEraser) {
      const svg = svgRef.current;
      if (!svg) return;
      erasedDuringStroke.current.clear();
      isErasingRef.current = true;
      const local = pointerEventToLocalPoint(e, svg);
      setEraserPos(local);
      eraseAtPointer(local);
      return;
    }

    // Cursor + seleccion: arrastre de extremo, de cuerpo, o re-seleccion.
    if (isEditMode) {
      const { local, dp } = localToDrawing(e);
      const selected = drawings.find((d) => d.id === selectedDrawingId) ?? null;
      if (selected && !selected.locked && dp && chart && mainSeries) {
        // 1) ¿Agarro un EXTREMO de la linea seleccionada?
        if (ENDPOINT_EDIT_TYPES.has(selected.type)) {
          for (let i = 0; i < selected.points.length; i++) {
            const lp = drawingPointToLocalPointRobust(
              selected.points[i], chart, mainSeries, convCtx.bars, convCtx.future
            );
            if (lp && Math.hypot(local.x - lp.x, local.y - lp.y) <= HANDLE_RADIUS_PX) {
              dragRef.current = {
                drawingId: selected.id,
                mode: "endpoint",
                endpointIndex: i,
                startDp: dp,
                originalPoints: selected.points.map((p) => ({ ...p })),
              };
              return;
            }
          }
        }
        // 2) ¿Agarro el CUERPO? (mueve la linea completa conservando pendiente)
        const range = instance?.getVisibleTimeRangeMs() ?? null;
        if (hitTest(selected, local, chart, mainSeries, size, range, HIT_TOLERANCE, convCtx)) {
          dragRef.current = {
            drawingId: selected.id,
            mode: "body",
            endpointIndex: -1,
            startDp: dp,
            originalPoints: selected.points.map((p) => ({ ...p })),
          };
          return;
        }
      }
      // 3) Click fuera: re-selecciona otro dibujo o deselecciona.
      const hit = findHitDrawing(local);
      selectDrawing(hit ? hit.id : null);
      return;
    }

    const { local, dp } = localToDrawing(e);
    if (DEV) {
      // eslint-disable-next-line no-console
      console.debug("[DrawingLayer] pointer down", {
        preset: sourceTimeframe,
        activeSymbol: symbol,
        activeTool,
        localPoint: local,
        convertedPoint: dp,
        hasChart: !!chart,
        hasMainSeries: !!mainSeries,
      });
      setDebug({ local, dp });
    }
    if (!dp) return; // click fuera del area valida: no crea punto, no crashea

    const cur = interactionRef.current;
    if (cur.mode === "awaiting_second_point") {
      void finalize(cur.tool, [cur.firstPoint, dp]);
      // Permanece en la misma herramienta para encadenar otro dibujo.
      setInteraction({ mode: "awaiting_first_point", tool: cur.tool });
    } else {
      const tool = cur.mode === "awaiting_first_point" ? cur.tool : (activeTool as TwoPointTool);
      setInteraction({ mode: "awaiting_second_point", tool, firstPoint: dp, previewPoint: dp });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // Goma: sigue al puntero (circulo-preview) y, si esta presionado, borra.
    if (isEraser) {
      const svg = svgRef.current;
      if (!svg) return;
      const local = pointerEventToLocalPoint(e, svg);
      setEraserPos(local);
      if (isErasingRef.current) eraseAtPointer(local);
      return;
    }

    // Arrastre de edicion en curso (cursor): actualiza el borrador en vivo.
    const drag = dragRef.current;
    if (drag) {
      const { dp } = localToDrawing(e);
      if (!dp) return;
      if (drag.mode === "body") {
        const dt = dp.time - drag.startDp.time;
        const dPrice = dp.price - drag.startDp.price;
        setDraft({
          id: drag.drawingId,
          points: drag.originalPoints.map((p) => ({
            time: p.time + dt,
            price: p.price + dPrice,
          })),
        });
      } else {
        const points = drag.originalPoints.map((p) => ({ ...p }));
        points[drag.endpointIndex] = dp;
        setDraft({ id: drag.drawingId, points });
      }
      return;
    }

    if (interactionRef.current.mode !== "awaiting_second_point") return;
    const { dp } = localToDrawing(e);
    if (!dp) return;
    setInteraction((prev) =>
      prev.mode === "awaiting_second_point" ? { ...prev, previewPoint: dp } : prev
    );
  };

  const endEraserStroke = (e: React.PointerEvent) => {
    isErasingRef.current = false;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* puede no estar capturado */
    }
  };

  // Suelta el arrastre de edicion: persiste los puntos nuevos en SQL (ms).
  const finishDrag = (e: React.PointerEvent, persist: boolean) => {
    const drag = dragRef.current;
    dragRef.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* puede no estar capturado */
    }
    setDraft((current) => {
      if (persist && drag && current && current.id === drag.drawingId) {
        const drawing = drawings.find((d) => d.id === drag.drawingId);
        if (drawing) {
          void updateDrawing({ ...drawing, points: current.points });
        }
      }
      return null;
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (isEraser) endEraserStroke(e);
    if (dragRef.current) finishDrag(e, true);
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (isEraser) endEraserStroke(e);
    if (dragRef.current) finishDrag(e, false);
  };

  const onPointerLeave = () => {
    if (isEraser) setEraserPos(null);
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (!isDrawingActive) return;
    e.preventDefault();
    setInteraction((prev) =>
      prev.mode === "awaiting_second_point"
        ? { mode: "awaiting_first_point", tool: prev.tool }
        : prev
    );
  };

  // ---- Render del overlay ----
  const visibleRange: VisibleRange = instance ? instance.getVisibleTimeRangeMs() : null;

  // Durante el arrastre, el dibujo editado se pinta con los puntos BORRADOR.
  const effectiveDrawings = draft
    ? drawings.map((d) => (d.id === draft.id ? { ...d, points: draft.points } : d))
    : drawings;

  const renderableLines = chart && mainSeries
    ? effectiveDrawings
        .filter((d) => d.visible)
        .map((d) =>
          renderDrawing(d, chart, mainSeries, size, d.id === selectedDrawingId, {
            showLabel: showTimeframeLabels,
            color: resolveDrawingColor(d, timeframeColors),
            visibleRange,
            ctx: convCtx,
          })
        )
        .filter((el): el is JSX.Element => el !== null)
    : [];

  // Manijas de extremos del dibujo seleccionado (solo lineas, con cursor).
  let handleEls: JSX.Element[] = [];
  if (isCursor && chart && mainSeries && selectedDrawingId) {
    const selected = effectiveDrawings.find((d) => d.id === selectedDrawingId);
    if (selected && selected.visible && !selected.locked && ENDPOINT_EDIT_TYPES.has(selected.type)) {
      handleEls = selected.points
        .map((p, i) => {
          const lp = drawingPointToLocalPointRobust(
            p, chart, mainSeries, convCtx.bars, convCtx.future
          );
          if (!lp) return null;
          return (
            <circle
              key={`handle-${selected.id}-${i}`}
              cx={lp.x}
              cy={lp.y}
              r={5}
              fill="#0d1017"
              stroke={SELECT_COLOR}
              strokeWidth={2}
              pointerEvents="none"
            />
          );
        })
        .filter((el): el is JSX.Element => el !== null);
    }
  }

  // Preview acorde a la herramienta activa.
  let previewEl: JSX.Element | null = null;
  if (chart && mainSeries && interaction.mode === "awaiting_second_point" && interaction.previewPoint) {
    const previewColor = timeframeColors[sourceTimeframe] ?? DRAW_COLOR;
    previewEl = renderPreview(
      interaction.tool,
      interaction.firstPoint,
      interaction.previewPoint,
      chart,
      mainSeries,
      visibleRange,
      previewColor
    );
  }

  return (
    <>
      <svg
        ref={svgRef}
        className={`drawing-overlay ${overlayInteractive ? "drawing-active" : "drawing-inactive"}`}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 20,
          pointerEvents: overlayInteractive ? "auto" : "none",
          // La goma oculta el cursor nativo: el circulo-preview es el cursor.
          cursor: isEraser
            ? "none"
            : isDrawingActive
              ? "crosshair"
              : isEditMode
                ? "move"
                : "default",
          touchAction: overlayInteractive ? "none" : "auto",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onContextMenu={onContextMenu}
      >
        {renderableLines}
        {handleEls}
        {previewEl}
        {isEraser && eraserPos && (
          <circle
            cx={eraserPos.x}
            cy={eraserPos.y}
            r={DEFAULT_ERASER_RADIUS_PX}
            fill="rgba(239,68,68,0.08)"
            stroke="#f87171"
            strokeWidth={1}
            strokeDasharray="3 2"
            pointerEvents="none"
          />
        )}
      </svg>

      {DEV && SHOW_DRAWING_DEBUG_PANEL && isDrawingActive && (
        <div
          style={{
            position: "absolute",
            left: 6,
            bottom: 6,
            zIndex: 25,
            pointerEvents: "none",
            font: "10px ui-monospace, monospace",
            color: "#cbd5e1",
            background: "rgba(19,23,34,0.85)",
            border: "1px solid #2a3142",
            borderRadius: 4,
            padding: "4px 6px",
            lineHeight: 1.4,
            whiteSpace: "pre",
          }}
        >
          {`${activeTool} · ${interaction.mode}
chart:${chart ? "OK" : "—"} series:${mainSeries ? "OK" : "—"} overlay:active
local:${debug.local ? `${Math.round(debug.local.x)},${Math.round(debug.local.y)}` : "—"} ` +
            `conv:${debug.dp ? `${new Date(debug.dp.time).toISOString().slice(0, 10)} @ ${debug.dp.price.toFixed(2)}` : "null"}
dibujos:${drawings.length}`}
        </div>
      )}
    </>
  );
}

// Lineas FINITAS (se recortan al rango visible, nunca se extienden).
const FINITE_LINE_TYPES = new Set<Drawing["type"]>(["free_line", "dotted_line"]);
// Rectas PROYECTADAS al rango visible completo.
const PROJECTED_LINE_TYPES = new Set<Drawing["type"]>(["extended_trendline", "trendline", "ray"]);

/** Contexto de conversion: velas reales del panel + grid de whitespace futuro. */
interface ConvCtx {
  bars: readonly { time: number }[];
  future: FutureConversionInfo | null;
}

/**
 * Punto -> pixel con conversion ROBUSTA de tiempo: primero la conversion
 * nativa; si el timestamp no existe en la escala de ESTE chart (dibujo creado
 * en otra temporalidad), interpola entre las COORDENADAS REALES de las velas
 * vecinas (nunca sobre el ancho del contenedor, que desalineaba los dibujos).
 */
function toLocal(
  point: DrawingPoint,
  chart: IChartApi,
  mainSeries: MainSeries,
  ctx: ConvCtx
): LocalPoint | null {
  return drawingPointToLocalPointRobust(point, chart, mainSeries, ctx.bars, ctx.future);
}

/**
 * Extremos en pixel de una linea segun su tipo:
 * - finita (free_line/dotted_line): clip al rango visible; null si no solapa.
 * - proyectada (extended_trendline): recta evaluada en los bordes visibles
 *   (incluido el whitespace futuro si esta a la vista).
 * No exige que los timestamps originales existan en la serie del chart destino.
 */
function lineLocalPoints(
  d: Drawing,
  chart: IChartApi,
  mainSeries: MainSeries,
  visibleRange: VisibleRange,
  ctx: ConvCtx
): [LocalPoint, LocalPoint] | null {
  if (d.points.length < 2) {
    debugSkip(d, "invalid_points");
    return null;
  }

  if (FINITE_LINE_TYPES.has(d.type)) {
    if (visibleRange) {
      const clip = clipFreeLineSegmentToVisibleRange({
        p1: d.points[0],
        p2: d.points[1],
        visibleStartMs: visibleRange.startMs,
        visibleEndMs: visibleRange.endMs,
      });
      if (!clip) {
        debugSkip(d, "outside_visible_range", { visibleRange });
        return null; // fuera de la vista de este chart: no se dibuja
      }
      const a = toLocal(clip[0], chart, mainSeries, ctx);
      const b = toLocal(clip[1], chart, mainSeries, ctx);
      if (!a || !b) debugSkip(d, "robust_time_coordinate_null", { clip, visibleRange });
      return a && b ? [a, b] : null;
    }
    // Sin rango visible (ej. tests): segmento crudo A-B (finito).
    const a = drawingPointToLocalPoint(d.points[0], chart, mainSeries);
    const b = drawingPointToLocalPoint(d.points[1], chart, mainSeries);
    return a && b ? [a, b] : null;
  }

  // Recta extendida (proyectada al rango visible).
  if (visibleRange) {
    const proj = projectLineToVisibleRange(d.points, visibleRange.startMs, visibleRange.endMs);
    if (proj) {
      const a = toLocal(proj[0], chart, mainSeries, ctx);
      const b = toLocal(proj[1], chart, mainSeries, ctx);
      if (a && b) return [a, b];
      debugSkip(d, "robust_time_coordinate_null", { proj, visibleRange });
    }
  }
  const a = drawingPointToLocalPoint(d.points[0], chart, mainSeries);
  const b = drawingPointToLocalPoint(d.points[1], chart, mainSeries);
  return a && b ? [a, b] : null;
}

/**
 * Caja delimitadora en pixel para formas de dos esquinas (rect/ellipse).
 * El rango de TIEMPO se recorta al visible (la forma se ve parcialmente si
 * sobresale); el rango de PRECIO se mantiene. No requiere coincidencia exacta
 * de timestamps con velas del chart destino.
 */
function boundingBox(
  d: Drawing,
  chart: IChartApi,
  mainSeries: MainSeries,
  visibleRange: VisibleRange,
  ctx: ConvCtx
): { x: number; y: number; w: number; h: number } | null {
  if (d.points.length < 2) {
    debugSkip(d, "invalid_points");
    return null;
  }
  const [pa, pb] = d.points;
  let startMs = Math.min(pa.time, pb.time);
  let endMs = Math.max(pa.time, pb.time);

  if (visibleRange) {
    startMs = Math.max(startMs, visibleRange.startMs);
    endMs = Math.min(endMs, visibleRange.endMs);
    if (startMs > endMs) {
      debugSkip(d, "outside_visible_range", { visibleRange });
      return null;
    }
  }

  const minPrice = Math.min(pa.price, pb.price);
  const maxPrice = Math.max(pa.price, pb.price);

  const x0 = timeMsToCoordinateRobust({ timeMs: startMs, chart, bars: ctx.bars, future: ctx.future });
  const x1 = timeMsToCoordinateRobust({ timeMs: endMs, chart, bars: ctx.bars, future: ctx.future });
  const yTop = mainSeries.priceToCoordinate(maxPrice);
  const yBottom = mainSeries.priceToCoordinate(minPrice);
  if (x0 == null || x1 == null) {
    debugSkip(d, "robust_time_coordinate_null", { startMs, endMs, visibleRange });
    return null;
  }
  if (yTop == null || yBottom == null) {
    debugSkip(d, "price_to_coordinate_null");
    return null;
  }
  return {
    x: Math.min(x0, x1),
    y: Math.min(Number(yTop), Number(yBottom)),
    w: Math.abs(x1 - x0),
    h: Math.abs(Number(yBottom) - Number(yTop)),
  };
}

function dashFor(style: Drawing["style"]): string | undefined {
  return style.lineStyle === "dashed" ? "8 5" : style.lineStyle === "dotted" ? "2 4" : undefined;
}

interface RenderOpts {
  showLabel: boolean;
  color: string;
  visibleRange: VisibleRange;
  ctx: ConvCtx;
}

function renderDrawing(
  d: Drawing,
  chart: IChartApi,
  mainSeries: MainSeries,
  size: { w: number; h: number },
  selected: boolean,
  opts: RenderOpts
): JSX.Element | null {
  const color = selected ? SELECT_COLOR : opts.color;
  const width = (d.style.width ?? 2) + (selected ? 1 : 0);
  const dash = dashFor(d.style);

  // Manijas de seleccion sobre los puntos ORIGINALES (si son visibles).
  const rawHandles = (pts: DrawingPoint[]) =>
    selected
      ? pts
          .map((p) => toLocal(p, chart, mainSeries, opts.ctx))
          .filter((p): p is LocalPoint => !!p)
          .map((p, i) => (
            <rect key={`h${i}`} x={p.x - 3} y={p.y - 3} width={6} height={6} fill={SELECT_COLOR} />
          ))
      : null;

  if (FINITE_LINE_TYPES.has(d.type) || PROJECTED_LINE_TYPES.has(d.type)) {
    const seg = lineLocalPoints(d, chart, mainSeries, opts.visibleRange, opts.ctx);
    if (!seg) return null;
    const [a, b] = seg;
    const label =
      opts.showLabel ? (
        <text x={b.x + 6} y={b.y - 6} fill={color} fontSize={10}>
          {d.sourceTimeframe}
        </text>
      ) : null;
    return (
      <g key={d.id}>
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={color}
          strokeWidth={width}
          strokeDasharray={dash}
          opacity={d.style.opacity ?? 1}
        />
        {rawHandles(d.points)}
        {label}
      </g>
    );
  }

  switch (d.type) {
    case "horizontal": {
      // Solo depende del PRECIO: se pinta aunque su timestamp ancla no exista
      // en la escala de este chart.
      const yRaw = d.points[0] ? mainSeries.priceToCoordinate(d.points[0].price) : null;
      if (yRaw == null || !Number.isFinite(yRaw)) {
        debugSkip(d, "price_to_coordinate_null");
        return null;
      }
      const y = Number(yRaw);
      return (
        <g key={d.id}>
          <line x1={0} y1={y} x2={size.w} y2={y} stroke={color} strokeWidth={width} strokeDasharray={dash} opacity={d.style.opacity ?? 1} />
          {rawHandles([d.points[0]])}
        </g>
      );
    }
    case "vertical": {
      const p0 = d.points[0]
        ? toLocal(d.points[0], chart, mainSeries, opts.ctx)
        : null;
      if (!p0) {
        debugSkip(d, "robust_time_coordinate_null", { visibleRange: opts.visibleRange });
        return null;
      }
      return (
        <g key={d.id}>
          <line x1={p0.x} y1={0} x2={p0.x} y2={size.h} stroke={color} strokeWidth={width} strokeDasharray={dash} opacity={d.style.opacity ?? 1} />
          {rawHandles([d.points[0]])}
        </g>
      );
    }
    case "rectangle": {
      const box = boundingBox(d, chart, mainSeries, opts.visibleRange, opts.ctx);
      if (!box) return null;
      return (
        <g key={d.id}>
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            fill={color}
            fillOpacity={d.style.fillOpacity ?? 0.12}
            stroke={color}
            strokeWidth={width}
            strokeOpacity={d.style.opacity ?? 0.6}
          />
          {rawHandles([d.points[0], d.points[1]])}
        </g>
      );
    }
    case "ellipse": {
      const box = boundingBox(d, chart, mainSeries, opts.visibleRange, opts.ctx);
      if (!box) return null;
      return (
        <g key={d.id}>
          <ellipse
            cx={box.x + box.w / 2}
            cy={box.y + box.h / 2}
            rx={box.w / 2}
            ry={box.h / 2}
            fill={color}
            fillOpacity={d.style.fillOpacity ?? 0.1}
            stroke={color}
            strokeWidth={width}
            strokeOpacity={d.style.opacity ?? 0.6}
          />
          {rawHandles([d.points[0], d.points[1]])}
        </g>
      );
    }
    default:
      return null;
  }
}

/** Preview del dibujo en curso, acorde a la herramienta. */
function renderPreview(
  tool: TwoPointTool,
  first: DrawingPoint,
  preview: DrawingPoint,
  chart: IChartApi,
  mainSeries: MainSeries,
  visibleRange: VisibleRange,
  color: string
): JSX.Element | null {
  const a = drawingPointToLocalPoint(first, chart, mainSeries);
  const b = drawingPointToLocalPoint(preview, chart, mainSeries);
  if (!a || !b) return null;

  switch (tool) {
    case "free_line":
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={2} strokeDasharray="6 4" opacity={0.9} />;
    case "dotted_line":
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={2} strokeDasharray="2 4" opacity={0.9} />;
    case "extended_trendline": {
      // Preview proyectado al rango visible (como quedara al confirmar).
      if (visibleRange) {
        const proj = projectLineToVisibleRange([first, preview], visibleRange.startMs, visibleRange.endMs);
        if (proj) {
          const pa = drawingPointToLocalPoint(proj[0], chart, mainSeries);
          const pb = drawingPointToLocalPoint(proj[1], chart, mainSeries);
          if (pa && pb) {
            return <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={color} strokeWidth={2} strokeDasharray="6 4" opacity={0.7} />;
          }
        }
      }
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={2} strokeDasharray="6 4" opacity={0.7} />;
    }
    case "rectangle": {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      return (
        <rect x={x} y={y} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill={color} fillOpacity={0.1} stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />
      );
    }
    case "ellipse": {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      return (
        <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill={color} fillOpacity={0.08} stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />
      );
    }
  }
}

// Hit-test de seleccion/borrado en coordenadas de pixel del panel.
// `tolerance` permite radios mayores (ej. el "pincel" de la goma).
function hitTest(
  d: Drawing,
  cursor: LocalPoint,
  chart: IChartApi,
  mainSeries: MainSeries,
  size: { w: number; h: number },
  visibleRange: VisibleRange,
  tolerance: number = HIT_TOLERANCE,
  ctx: ConvCtx = { bars: [], future: null }
): boolean {
  if (FINITE_LINE_TYPES.has(d.type) || PROJECTED_LINE_TYPES.has(d.type)) {
    const seg = lineLocalPoints(d, chart, mainSeries, visibleRange, ctx);
    return !!seg && distancePointToSegment(cursor, seg[0], seg[1]) <= tolerance;
  }
  switch (d.type) {
    case "horizontal": {
      // Solo importa el precio (la linea cruza todo el panel).
      const yRaw = d.points[0] ? mainSeries.priceToCoordinate(d.points[0].price) : null;
      return yRaw != null && Number.isFinite(yRaw) && Math.abs(cursor.y - Number(yRaw)) <= tolerance;
    }
    case "vertical": {
      const p0 = d.points[0]
        ? drawingPointToLocalPointRobust(d.points[0], chart, mainSeries, ctx.bars, ctx.future)
        : null;
      return !!p0 && Math.abs(cursor.x - p0.x) <= tolerance;
    }
    case "rectangle": {
      const box = boundingBox(d, chart, mainSeries, visibleRange, ctx);
      if (!box) return false;
      // Dentro del area o cerca del borde (tolerancia).
      return (
        cursor.x >= box.x - tolerance &&
        cursor.x <= box.x + box.w + tolerance &&
        cursor.y >= box.y - tolerance &&
        cursor.y <= box.y + box.h + tolerance
      );
    }
    case "ellipse": {
      const box = boundingBox(d, chart, mainSeries, visibleRange, ctx);
      if (!box || box.w === 0 || box.h === 0) return false;
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const rx = box.w / 2 + tolerance;
      const ry = box.h / 2 + tolerance;
      const nx = (cursor.x - cx) / rx;
      const ny = (cursor.y - cy) / ry;
      return nx * nx + ny * ny <= 1;
    }
    default:
      void size;
      return false;
  }
}
