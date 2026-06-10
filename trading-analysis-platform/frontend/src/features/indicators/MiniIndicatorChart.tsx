import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";

export interface IndicatorSeries {
  id: string;
  color: string;
  type?: "line" | "histogram";
  /** time en segundos UTC; color opcional por punto (histogramas +/-). */
  points: { time: number; value: number; color?: string }[];
}

interface Props {
  series: IndicatorSeries[];
  height?: number;
  title: string;
  /** Lineas horizontales de referencia (ej. RSI 70/50/30). */
  referenceLines?: { value: number; color: string }[];
}

/** Mini panel inferior para indicadores en escala propia (RSI, MACD, ...). */
export function MiniIndicatorChart({ series, height = 120, title, referenceLines = [] }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b93a7",
        fontSize: 10,
      },
      grid: { vertLines: { color: "#1c2230" }, horzLines: { color: "#1c2230" } },
      rightPriceScale: { borderColor: "#1c2230" },
      timeScale: { borderColor: "#1c2230", timeVisible: true },
    });
    chartRef.current = chart;

    const handles = series.map((s, i) => {
      const api =
        s.type === "histogram"
          ? chart.addHistogramSeries({
              color: s.color,
              lastValueVisible: false,
              priceLineVisible: false,
            })
          : chart.addLineSeries({
              color: s.color,
              lineWidth: 1,
              lastValueVisible: false,
              priceLineVisible: false,
            });
      api.setData(
        s.points.map((p) => ({
          time: p.time as UTCTimestamp,
          value: p.value,
          ...(p.color ? { color: p.color } : {}),
        }))
      );
      // Lineas de referencia ancladas a la primera serie (RSI 70/50/30...).
      if (i === 0) {
        for (const rl of referenceLines) {
          api.createPriceLine({
            price: rl.value,
            color: rl.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: "",
          });
        }
      }
      return api;
    });
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);

    return () => {
      ro.disconnect();
      handles.forEach((h) => chart.removeSeries(h));
      chart.remove();
      chartRef.current = null;
    };
  }, [series, height, referenceLines]);

  return (
    <div className="rounded border border-edge bg-panel">
      <div className="border-b border-edge px-2 py-1 text-[11px] font-semibold text-gray-300">{title}</div>
      <div ref={ref} style={{ height }} />
    </div>
  );
}
