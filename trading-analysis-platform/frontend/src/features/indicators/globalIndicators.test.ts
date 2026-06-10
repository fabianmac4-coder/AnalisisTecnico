import { describe, it, expect } from "vitest";
import {
  buildPriceOverlays,
  buildRsiPane,
  buildMacdPane,
  normalizeIndicatorConfigs,
  validateIndicatorParams,
  isVolumeEnabled,
  getVolumeStyle,
  DEFAULT_GLOBAL_INDICATORS,
  type GlobalIndicatorConfig,
} from "./globalIndicators";
import type { Candle } from "@/features/charting/chartEngine/ChartEngineAdapter";

function bars(closesArr: number[], startMs = 1000, stepMs = 1000): Candle[] {
  return closesArr.map((c, i) => ({
    time: startMs + i * stepMs,
    open: c,
    high: c,
    low: c,
    close: c,
    volume: 100,
  }));
}

function cfg(partial: Partial<GlobalIndicatorConfig>): GlobalIndicatorConfig {
  return {
    id: "x",
    type: "SMA",
    name: "X",
    visible: true,
    applyToAllTimeframes: true,
    params: {},
    style: {},
    ...partial,
  };
}

const SMA3 = cfg({ id: "sma-3", type: "SMA", params: { period: 3 }, style: { color: "#fff" } });

describe("buildPriceOverlays", () => {
  it("SMA activa produce una linea overlay", () => {
    const out = buildPriceOverlays(bars([1, 2, 3, 4, 5]), 0, [SMA3]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("sma-3");
    expect(out[0].points.length).toBe(3); // ventana completa desde i=2
  });

  it("usa warmup para el calculo pero FILTRA la salida al rango visible", () => {
    const all = bars([1, 2, 3, 4, 5]); // times 1000..5000
    const visibleFrom = 4000; // las dos primeras "visibles" serian 4000 y 5000
    const out = buildPriceOverlays(all, visibleFrom, [SMA3]);
    // Sin warmup, SMA3 en solo 2 velas visibles seria imposible; con warmup
    // hay valor YA desde la primera vela visible.
    expect(out[0].points).toHaveLength(2);
    expect(out[0].points[0].time).toBe(4); // segundos
  });

  it("indicadores distintos por datos del panel (no se comparte el calculo)", () => {
    const a = buildPriceOverlays(bars([1, 2, 3, 4, 5]), 0, [SMA3]);
    const b = buildPriceOverlays(bars([10, 20, 30, 40, 50]), 0, [SMA3]);
    expect(a[0].points.at(-1)!.value).not.toBe(b[0].points.at(-1)!.value);
  });

  it("BBANDS produce tres lineas (upper/middle/lower)", () => {
    const bb = cfg({ id: "bb", type: "BBANDS", params: { period: 3, stdDev: 2 }, style: { color: "#1", secondaryColor: "#2", tertiaryColor: "#3" } });
    const out = buildPriceOverlays(bars([1, 2, 3, 4, 5]), 0, [bb]);
    expect(out.map((l) => l.id)).toEqual(["bb-upper", "bb-middle", "bb-lower"]);
  });

  it("indicador no visible no genera overlay", () => {
    const out = buildPriceOverlays(bars([1, 2, 3]), 0, [{ ...SMA3, visible: false }]);
    expect(out).toHaveLength(0);
  });
});

describe("paneles inferiores", () => {
  it("RSI genera serie + lineas de referencia (sobrecompra/sobreventa)", () => {
    const rsi = cfg({ id: "rsi", type: "RSI", params: { period: 3, overbought: 70, oversold: 30 } });
    const pane = buildRsiPane(bars([1, 2, 3, 2, 4, 5, 6]), 0, rsi);
    expect(pane.series[0].points.length).toBeGreaterThan(0);
    expect(pane.referenceLines?.map((r) => r.value)).toEqual([70, 50, 30]);
  });

  it("MACD genera histograma + linea + senal; histograma coloreado por signo", () => {
    const macd = cfg({
      id: "macd",
      type: "MACD",
      params: { fastPeriod: 2, slowPeriod: 4, signalPeriod: 2 },
      style: { histogramPositiveColor: "#00ff00", histogramNegativeColor: "#ff0000" },
    });
    const pane = buildMacdPane(bars([1, 2, 3, 4, 5, 6, 5, 4, 3, 2]), 0, macd);
    expect(pane.series.map((s) => s.id)).toEqual(["macd-hist", "macd-line", "macd-signal"]);
    const hist = pane.series[0].points;
    expect(hist.length).toBeGreaterThan(0);
    const up = hist.find((p) => p.value >= 0);
    const down = hist.find((p) => p.value < 0);
    if (up) expect(up.color!.startsWith("#00ff00")).toBe(true);
    if (down) expect(down.color!.startsWith("#ff0000")).toBe(true);
  });
});

describe("validateIndicatorParams", () => {
  it("MACD: fast >= slow es invalido", () => {
    expect(
      validateIndicatorParams("MACD", { fastPeriod: 26, slowPeriod: 12, signalPeriod: 9 })
    ).toBeTruthy();
    expect(
      validateIndicatorParams("MACD", { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 })
    ).toBeNull();
  });

  it("periodos invalidos rechazados; RSI exige periodo >= 2", () => {
    expect(validateIndicatorParams("SMA", { period: 0 })).toBeTruthy();
    expect(validateIndicatorParams("RSI", { period: 1 })).toBeTruthy();
    expect(validateIndicatorParams("RSI", { period: 2 })).toBeNull();
    expect(validateIndicatorParams("BBANDS", { period: 20, stdDev: 0 })).toBeTruthy();
  });
});

describe("normalizeIndicatorConfigs (migracion)", () => {
  it("mapea ids legados conservando la visibilidad del usuario", () => {
    const out = normalizeIndicatorConfigs([
      { id: "SMA_200", visible: true },
      { id: "VOLUME", visible: false },
    ]);
    expect(out.find((i) => i.id === "sma-200")?.visible).toBe(true);
    expect(out.find((i) => i.id === "volume")?.visible).toBe(false);
    // Completa el resto con defaults (RSI/MACD/BBANDS presentes).
    expect(out.map((i) => i.id)).toEqual(DEFAULT_GLOBAL_INDICATORS.map((i) => i.id));
  });

  it("entrada invalida -> defaults completos", () => {
    expect(normalizeIndicatorConfigs(undefined)).toHaveLength(DEFAULT_GLOBAL_INDICATORS.length);
  });
});

describe("volumen", () => {
  it("isVolumeEnabled refleja el toggle; estilo con defaults", () => {
    expect(isVolumeEnabled(DEFAULT_GLOBAL_INDICATORS)).toBe(true);
    const off = DEFAULT_GLOBAL_INDICATORS.map((i) =>
      i.type === "VOLUME" ? { ...i, visible: false } : i
    );
    expect(isVolumeEnabled(off)).toBe(false);
    const style = getVolumeStyle(DEFAULT_GLOBAL_INDICATORS);
    expect(style.positiveColor).toBe("#22c55e");
    expect(style.colorByCandleDirection).toBe(true);
  });
});
