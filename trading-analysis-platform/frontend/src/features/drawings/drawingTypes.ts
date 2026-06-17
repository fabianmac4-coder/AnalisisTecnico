// Modelo de dibujos. REGLA CRITICA: las coordenadas se guardan en tiempo (ms)
// y precio reales, nunca en pixeles. Esto permite reproyectar un dibujo en
// otra temporalidad (y dibujar en el area de "futuro" mas alla del ultimo bar).

export type DrawingType =
  | "free_line"
  | "dotted_line"
  | "extended_trendline"
  | "rectangle"
  | "ellipse"
  | "horizontal"
  | "vertical"
  | "ray"
  | "trendline" // legado: se migra a free_line / extended_trendline
  | "parallel_channel"
  | "text"
  // Cajas de planificación riesgo/recompensa (tipo TradingView). Geometría en
  // points (3: entry/target/stop); datos extra en style.position. NO es una
  // entrada simulada (C050) salvo conversión explícita.
  | "LONG_POSITION"
  | "SHORT_POSITION";

export type PositionBoxType = "LONG_POSITION" | "SHORT_POSITION";

/** Datos NO geométricos de una caja de posición (viven en style.position). */
export interface PositionBoxData {
  toolType: PositionBoxType;
  quantity: number;
  fees?: number;
  notes?: string;
  accountCurrency?: string;
  chartSlotId?: string;
  chartRange?: string;
  chartInterval?: string;
  chartContextKey?: string;
}

/** Cálculos derivados de una caja de posición (no se persisten). */
export interface PositionBoxMetrics {
  riskPerShare: number;
  rewardPerShare: number;
  riskAmount: number;
  rewardAmount: number;
  riskPercent: number;
  rewardPercent: number;
  riskRewardRatio: number | null;
  targetPnL: number;
  stopPnL: number;
  breakEvenPrice?: number;
  isValid: boolean;
  validationMessage?: string;
}

export type LineStyleName = "solid" | "dashed" | "dotted";

/**
 * Herramientas de la toolbar.
 * - cursor: seleccion (click cerca de un dibujo lo selecciona).
 * - eraser: borra el dibujo mas cercano al click (uno a la vez).
 * - El resto son herramientas de DOS puntos (A -> preview -> B).
 */
export type DrawingTool =
  | "cursor"
  | "free_line"
  | "dotted_line"
  | "extended_trendline"
  | "rectangle"
  | "ellipse"
  | "eraser"
  // Cajas de posición: se crean con UN click (entry) + target/stop/duración por
  // defecto; luego se editan con handles/modal. NO son herramientas de 2 puntos.
  | "LONG_POSITION"
  | "SHORT_POSITION";

/** Herramientas de dos puntos (todas crean un Drawing con 2 DrawingPoint). */
export type TwoPointTool = Exclude<
  DrawingTool,
  "cursor" | "eraser" | "LONG_POSITION" | "SHORT_POSITION"
>;

export const TWO_POINT_TOOLS: readonly TwoPointTool[] = [
  "free_line",
  "dotted_line",
  "extended_trendline",
  "rectangle",
  "ellipse",
] as const;

export function isTwoPointTool(tool: DrawingTool): tool is TwoPointTool {
  return (TWO_POINT_TOOLS as readonly string[]).includes(tool);
}

/** Herramienta de caja de posición (creación con un click + defaults). */
export function isPositionTool(tool: DrawingTool): tool is PositionBoxType {
  return tool === "LONG_POSITION" || tool === "SHORT_POSITION";
}

/** Tipo de dibujo = caja de posición (Long/Short). */
export function isPositionType(type: DrawingType): type is PositionBoxType {
  return type === "LONG_POSITION" || type === "SHORT_POSITION";
}

export interface DrawingPoint {
  /** Unix milliseconds UTC. */
  time: number;
  price: number;
}

export interface DrawingStyle {
  color: string;
  width: number;
  lineStyle: LineStyleName;
  opacity: number;
  /** Opacidad del relleno para formas (rectangle/ellipse). */
  fillOpacity?: number;
  label?: string;
  extendLeft?: boolean;
  extendRight?: boolean;
  /** Si true, el color efectivo lo decide el color por temporalidad de origen. */
  usesTimeframeDefaultColor?: boolean;
  /** Datos extra de las cajas LONG/SHORT_POSITION (cantidad, fees, notas…). */
  position?: PositionBoxData;
}

export interface Drawing {
  id: string;
  symbol: string;
  /** Workspace de analisis (C030Id) dueno del dibujo. Aisla los dibujos por
   *  workspace; ausente solo en dibujos heredados (pre-workspaces). */
  c030Id?: number;
  /** Temporalidad de origen: clave de preset historica o contextKey dinamico
   *  (`${range}_${interval}`) cuando el slot usa un combo personalizado. */
  sourceTimeframe: string;
  type: DrawingType;
  points: DrawingPoint[];
  style: DrawingStyle;
  visible: boolean;
  locked: boolean;
  /** Visible en TODAS las temporalidades (nuevo modelo, default true). */
  showOnAllTimeframes: boolean;
  /** Temporalidades concretas donde mostrarlo (si no es global). */
  showOnTimeframes?: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  color: "#3b82f6",
  width: 2,
  lineStyle: "solid",
  opacity: 1,
};

/** Cuantos clicks (puntos) requiere cada tipo de dibujo para completarse. */
export const POINTS_REQUIRED: Record<DrawingType, number> = {
  free_line: 2,
  dotted_line: 2,
  extended_trendline: 2,
  ellipse: 2,
  horizontal: 1,
  vertical: 1,
  text: 1,
  trendline: 2,
  ray: 2,
  rectangle: 2,
  parallel_channel: 3,
  // Un click (entry); target/stop/duración se derivan por defecto.
  LONG_POSITION: 1,
  SHORT_POSITION: 1,
};
