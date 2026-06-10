// Tipos de indicadores tecnicos.

export type IndicatorType = "SMA" | "EMA" | "RSI" | "MACD" | "BBANDS" | "ATR" | "VOLUME";

export interface IndicatorConfig {
  id: string;
  symbol: string;
  panelKey: string; // "price" para overlays, o un panel inferior dedicado
  type: IndicatorType;
  params: Record<string, number | string | boolean>;
  style: Record<string, string | number | boolean>;
  visible: boolean;
}

/** Punto de una linea de indicador (alineado a la grafica en segundos UTC). */
export interface IndicatorLinePoint {
  time: number; // segundos UTC (formato Lightweight Charts)
  value: number;
}
