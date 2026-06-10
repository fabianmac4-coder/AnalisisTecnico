import { useEffect, useMemo, useRef, useState } from "react";
import type { ISeriesApi, UTCTimestamp } from "lightweight-charts";
import {
  LightweightChartsAdapter,
  type VolumeOverlayStyle,
} from "./chartEngine/LightweightChartsAdapter";
import type { Candle, ChartInstance, ChartType } from "./chartEngine/ChartEngineAdapter";
import type { Drawing } from "@/features/drawings/drawingTypes";
import type { PresetKey } from "@/utils/timeframes";
import { DrawingLayer } from "@/features/drawings/DrawingLayer";
import { createFutureWhitespace, PRESET_STEP_MS } from "./futureWhitespace";

/** Linea de indicador overlay sobre el precio (tiempo en segundos UTC). */
export interface OverlayLine {
  id: string;
  color: string;
  lineWidth?: number;
  points: { time: number; value: number }[];
}

interface Props {
  candles: Candle[];
  chartType: ChartType;
  intraday: boolean;
  showVolume: boolean;
  drawings: Drawing[];
  symbol: string;
  sourceTimeframe: PresetKey;
  editable: boolean;
  showTimeframeLabels?: boolean;
  overlays?: OverlayLine[];
  timeframeColors?: Record<PresetKey, string>;
  /** Precio canonico unico a mostrar en el eje de precio (igual en los 6). */
  canonicalPrice?: number | null;
  /** Cambio diario de la cotizacion (decide el color de la linea de precio). */
  canonicalChange?: number | null;
  /** Estilo del histograma de volumen (colores/opacidad del indicador global). */
  volumeStyle?: VolumeOverlayStyle;
}

/**
 * Componente nucleo que monta una grafica (via el adaptador) y superpone la capa
 * de dibujos. Reutilizado por ChartPanel (grid) y SummaryChart (resumen).
 */
export function ChartCanvas({
  candles,
  chartType,
  intraday,
  showVolume,
  drawings,
  symbol,
  sourceTimeframe,
  editable,
  showTimeframeLabels = false,
  overlays = [],
  timeframeColors,
  canonicalPrice = null,
  canonicalChange = null,
  volumeStyle,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<LightweightChartsAdapter | null>(null);
  const chartIdRef = useRef<string | null>(null);
  const overlaySeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const [instance, setInstance] = useState<ChartInstance | null>(null);

  // Whitespace futuro tras el ultimo bar real (habilita dibujar "al futuro").
  const futureTimesMs = useMemo(() => {
    const last = candles[candles.length - 1];
    if (!last) return [];
    return createFutureWhitespace({ lastTimeMs: last.time, preset: sourceTimeframe });
  }, [candles, sourceTimeframe]);

  // Info para el fallback de conversion de coordenadas en el area futura.
  const futureInfo = useMemo(() => {
    const last = candles[candles.length - 1];
    if (!last) return null;
    return {
      lastBarTimeMs: last.time,
      lastBarIndex: candles.length - 1,
      stepMs: PRESET_STEP_MS[sourceTimeframe],
    };
  }, [candles, sourceTimeframe]);

  // Crear/destruir la grafica.
  useEffect(() => {
    if (!containerRef.current) return;
    const adapter = new LightweightChartsAdapter();
    const inst = adapter.createChart(containerRef.current, {
      intraday,
      showVolume,
    });
    adapterRef.current = adapter;
    chartIdRef.current = inst.id;
    setInstance(inst);
    return () => {
      adapter.destroy(inst.id);
      adapterRef.current = null;
      chartIdRef.current = null;
      overlaySeriesRef.current.clear();
      setInstance(null);
    };
    // Solo al montar (intraday/showVolume no cambian para un mismo panel).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Datos (velas reales + whitespace futuro, sin OHLC falso).
  useEffect(() => {
    if (adapterRef.current && chartIdRef.current) {
      adapterRef.current.setData(chartIdRef.current, candles, futureTimesMs);
    }
  }, [candles, futureTimesMs]);

  // Tipo de grafica.
  useEffect(() => {
    if (adapterRef.current && chartIdRef.current) {
      adapterRef.current.setChartType(chartIdRef.current, chartType);
    }
  }, [chartType]);

  // Volumen DINAMICO: el toggle global agrega/quita el histograma en caliente
  // (antes solo se decidia al montar, por eso el toggle no hacia nada).
  useEffect(() => {
    if (adapterRef.current && chartIdRef.current) {
      adapterRef.current.setVolumeVisible(chartIdRef.current, showVolume, volumeStyle);
    }
  }, [showVolume, volumeStyle, candles, chartType]);

  // Linea de precio canonica (misma en las seis graficas). El color depende del
  // cambio diario de la cotizacion. Se re-aplica tras un cambio de tipo (la
  // serie se recrea), via chartType en deps.
  useEffect(() => {
    instance?.setCanonicalPriceLine(canonicalPrice, canonicalChange);
  }, [instance, canonicalPrice, canonicalChange, chartType]);

  // Overlays de indicadores (SMA/EMA/Bollinger...).
  useEffect(() => {
    const adapter = adapterRef.current;
    const chartId = chartIdRef.current;
    if (!adapter || !chartId) return;
    const api = adapter.getChartApi(chartId);
    if (!api) return;

    const existing = overlaySeriesRef.current;
    const nextIds = new Set(overlays.map((o) => o.id));

    // Eliminar overlays que ya no estan.
    for (const [id, series] of existing) {
      if (!nextIds.has(id)) {
        api.removeSeries(series);
        existing.delete(id);
      }
    }
    // Crear/actualizar.
    for (const o of overlays) {
      let series = existing.get(o.id);
      if (!series) {
        series = api.addLineSeries({ color: o.color, lineWidth: (o.lineWidth ?? 1) as 1 | 2 | 3 | 4 });
        existing.set(o.id, series);
      } else {
        series.applyOptions({ color: o.color });
      }
      series.setData(o.points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }
  }, [overlays]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <DrawingLayer
        instance={instance}
        drawings={drawings}
        editable={editable}
        symbol={symbol}
        sourceTimeframe={sourceTimeframe}
        showTimeframeLabels={showTimeframeLabels}
        timeframeColors={timeframeColors}
        futureInfo={futureInfo}
        candles={candles}
      />
    </div>
  );
}
