// Factory pura para construir un Drawing nuevo. Centraliza los valores por
// defecto y el estilo segun el tipo de herramienta. Facil de testear.

import { PRESET_KEYS } from "@/utils/timeframes";
import {
  DEFAULT_DRAWING_STYLE,
  isPositionTool,
  type Drawing,
  type DrawingStyle,
  type DrawingPoint,
  type DrawingType,
  type PositionBoxData,
} from "./drawingTypes";

function uuid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `dw_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

export interface CreateDrawingParams {
  symbol: string;
  /** Workspace de análisis dueño del dibujo (aislamiento por C030Id). */
  c030Id?: number;
  sourceTimeframe: string;
  type: DrawingType;
  points: DrawingPoint[];
  color?: string;
  label?: string;
  /** Datos extra de una caja LONG/SHORT_POSITION (cantidad, fees, notas…). */
  position?: PositionBoxData;
}

/** Estilo por defecto segun el tipo de dibujo. */
function styleForType(type: DrawingType, color: string): DrawingStyle {
  const base: DrawingStyle = {
    ...DEFAULT_DRAWING_STYLE,
    color,
    // Por defecto los dibujos son FINITOS (no se extienden).
    extendLeft: false,
    extendRight: false,
  };
  switch (type) {
    case "dotted_line":
      return { ...base, lineStyle: "dotted" };
    case "extended_trendline":
      // Recta proyectada: se extiende a ambos lados del segmento A-B.
      return { ...base, extendLeft: true, extendRight: true };
    case "rectangle":
      return { ...base, width: 1, opacity: 0.25, fillOpacity: 0.12 };
    case "ellipse":
      return { ...base, width: 1, opacity: 0.35, fillOpacity: 0.1 };
    case "LONG_POSITION":
    case "SHORT_POSITION":
      // Las zonas verde/roja usan colores propios; el estilo base es discreto.
      return { ...base, width: 1, opacity: 0.9, fillOpacity: 0.12 };
    default:
      return base;
  }
}

export function createDrawing(params: CreateDrawingParams): Drawing {
  const now = new Date().toISOString();
  const color = params.color ?? DEFAULT_DRAWING_STYLE.color;
  // Las cajas de posición se acotan a SU temporalidad (no son globales).
  const isPosition = isPositionTool(params.type as never);
  return {
    id: uuid(),
    symbol: params.symbol.toUpperCase(),
    c030Id: params.c030Id,
    sourceTimeframe: params.sourceTimeframe,
    type: params.type,
    points: params.points,
    style: {
      ...styleForType(params.type, color),
      label: params.label,
      // El color por defecto lo gobierna la temporalidad de origen.
      usesTimeframeDefaultColor: params.color !== undefined,
      ...(params.position ? { position: params.position } : {}),
    },
    visible: true,
    locked: false,
    showOnAllTimeframes: !isPosition,
    showOnTimeframes: isPosition ? [params.sourceTimeframe] : [...PRESET_KEYS],
    createdAt: now,
    updatedAt: now,
    version: 3,
  };
}
