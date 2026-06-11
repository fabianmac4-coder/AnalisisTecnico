// Interfaz del motor de graficas. Aisla la app de la libreria concreta
// (Lightweight Charts hoy) para poder migrar a otra (ej. TradingView Advanced
// Charts) sin reescribir las features.

import type { Drawing } from "@/features/drawings/drawingTypes";

/** Vela normalizada que viaja por toda la app (tiempo en ms UTC). */
export interface Candle {
  time: number; // Unix milliseconds UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

export type ChartType = "candlestick" | "bars" | "line" | "area" | "volume";

export interface ChartOptions {
  intraday: boolean;
  showVolume?: boolean;
  /** Altura fija opcional; si se omite, se ajusta al contenedor. */
  height?: number;
}

/** Handle opaco a una instancia de grafica creada por el adaptador. */
export interface ChartInstance {
  id: string;
  /** Convierte tiempo(ms)+precio a coordenadas de pixel del contenedor. */
  toPixel(time: number, price: number): { x: number | null; y: number | null };
  /** Convierte coordenadas de pixel a tiempo(ms)+precio. */
  toMarket(x: number, y: number): { time: number | null; price: number | null };
  /** Suscribe a cambios de viewport (pan/zoom/resize) para repintar overlays. */
  onViewportChange(cb: () => void): () => void;
  /**
   * Suscribe al click sobre la grafica (coordenadas de pixel del panel).
   * Util para seleccionar dibujos sin capturar los eventos del canvas overlay,
   * de modo que el pan/zoom de la grafica siga funcionando.
   */
  onClick(cb: (x: number, y: number) => void): () => void;
  /** Elemento sobre el que se dibuja el overlay de dibujos. */
  getContainer(): HTMLElement;
  /**
   * Acceso al motor concreto para el overlay de dibujos (coordenadas y opciones).
   * Tipado como `unknown` en la interfaz para no acoplarla a una libreria; el
   * overlay de Lightweight Charts hace el cast a IChartApi / ISeriesApi.
   */
  getChartApi(): unknown;
  getMainSeries(): unknown;
  /** Habilita/inhabilita pan y zoom (se desactiva al dibujar). */
  setInteractionEnabled(enabled: boolean): void;
  /** Rango de tiempo visible en ms (para proyectar dibujos). Null si no hay datos. */
  getVisibleTimeRangeMs(): { startMs: number; endMs: number } | null;
  /**
   * Fija (o limpia con null) la linea de precio CANONICA en el eje de precio.
   * Reemplaza el ultimo-valor por defecto de la serie para que las seis graficas
   * muestren el MISMO precio actual. `change` (cambio diario de la cotizacion)
   * decide el color: verde si sube, rojo si baja, gris neutro si 0/desconocido.
   */
  setCanonicalPriceLine(price: number | null, change?: number | null): void;
  /**
   * Lineas de precio de ENTRADAS SIMULADAS (paper trading) del simbolo activo.
   * Opcional para no romper ChartInstance falsos en tests.
   */
  setSimulatedEntryLines?(
    lines: Array<{ price: number; color?: string | null; title?: string | null }>
  ): void;
}

export interface ChartEngineAdapter {
  createChart(container: HTMLElement, options: ChartOptions): ChartInstance;
  /**
   * Carga las velas reales y, opcionalmente, tiempos futuros (ms) que se anexan
   * como WHITESPACE tras el ultimo bar (sin OHLC falso) para poder dibujar en
   * el area futura del chart.
   */
  setData(chartId: string, bars: Candle[], futureTimesMs?: number[]): void;
  setChartType(chartId: string, type: ChartType): void;
  /** Muestra/oculta el histograma de volumen en caliente (toggle global). */
  setVolumeVisible(chartId: string, visible: boolean, style?: unknown): void;
  addDrawing(chartId: string, drawing: Drawing): void;
  removeDrawing(chartId: string, drawingId: string): void;
  updateDrawing(chartId: string, drawing: Drawing): void;
  destroy(chartId: string): void;
}
