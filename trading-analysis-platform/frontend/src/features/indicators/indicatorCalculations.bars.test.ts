// Pruebas de la API nueva de calculo (basada en velas, time en Unix ms).
import { describe, it, expect } from "vitest";
import {
  getSourceValue,
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateVolume,
  calculateRSI,
  calculateMACD,
} from "./indicatorCalculations";
import type { Candle } from "@/features/charting/chartEngine/ChartEngineAdapter";

function bar(close: number, time: number, extra: Partial<Candle> = {}): Candle {
  return { time, open: close, high: close, low: close, close, volume: 100, ...extra };
}

function bars(closes: number[]): Candle[] {
  return closes.map((c, i) => bar(c, (i + 1) * 1000));
}

describe("getSourceValue", () => {
  const b: Candle = { time: 1, open: 10, high: 20, low: 5, close: 15, volume: 1 };
  it("soporta todas las fuentes", () => {
    expect(getSourceValue(b, "close")).toBe(15);
    expect(getSourceValue(b, "open")).toBe(10);
    expect(getSourceValue(b, "high")).toBe(20);
    expect(getSourceValue(b, "low")).toBe(5);
    expect(getSourceValue(b, "hl2")).toBe(12.5);
    expect(getSourceValue(b, "hlc3")).toBeCloseTo(40 / 3, 6);
    expect(getSourceValue(b, "ohlc4")).toBe(12.5);
  });
});

describe("calculateSMA", () => {
  it("medias rodantes correctas; nada antes de la ventana; tiempos en ms", () => {
    const out = calculateSMA(bars([1, 2, 3, 4, 5]), { period: 3 });
    expect(out).toEqual([
      { time: 3000, value: 2 },
      { time: 4000, value: 3 },
      { time: 5000, value: 4 },
    ]);
  });
});

describe("calculateEMA", () => {
  it("se siembra con la SMA del primer bloque y usa alpha=2/(n+1)", () => {
    const out = calculateEMA(bars([1, 2, 3, 4]), { period: 3 });
    // seed = SMA(1,2,3) = 2 en t=3000; luego 4*0.5 + 2*0.5 = 3.
    expect(out[0]).toEqual({ time: 3000, value: 2 });
    expect(out[1].value).toBeCloseTo(3, 6);
  });

  it("sin datos suficientes -> vacio", () => {
    expect(calculateEMA(bars([1, 2]), { period: 3 })).toEqual([]);
  });
});

describe("calculateBollingerBands", () => {
  it("middle = SMA; bandas con desviacion rodante; stdDev cambia el ancho", () => {
    const data = bars([1, 2, 3]);
    const [p2] = calculateBollingerBands(data, { period: 3, stdDev: 2 });
    expect(p2.middle).toBe(2);
    const sd = Math.sqrt(2 / 3); // poblacional de [1,2,3]
    expect(p2.upper).toBeCloseTo(2 + 2 * sd, 6);
    expect(p2.lower).toBeCloseTo(2 - 2 * sd, 6);
    const [p1] = calculateBollingerBands(data, { period: 3, stdDev: 1 });
    expect(p1.upper - p1.lower).toBeCloseTo((p2.upper - p2.lower) / 2, 6);
  });
});

describe("calculateVolume", () => {
  it("marca direccion por vela (close >= open -> up)", () => {
    const data: Candle[] = [
      { time: 1, open: 10, high: 11, low: 9, close: 11, volume: 5 },
      { time: 2, open: 10, high: 11, low: 9, close: 9, volume: 7 },
    ];
    const out = calculateVolume(data);
    expect(out[0]).toEqual({ time: 1, value: 5, up: true });
    expect(out[1]).toEqual({ time: 2, value: 7, up: false });
  });
});

describe("calculateRSI (Wilder)", () => {
  it("solo subidas -> 100; solo bajadas -> 0; sin movimiento -> 50", () => {
    const up = calculateRSI(bars([1, 2, 3, 4, 5, 6]), { period: 3 });
    expect(up.every((p) => p.value === 100)).toBe(true);
    const down = calculateRSI(bars([6, 5, 4, 3, 2, 1]), { period: 3 });
    expect(down.every((p) => p.value === 0)).toBe(true);
    const flat = calculateRSI(bars([5, 5, 5, 5, 5]), { period: 3 });
    expect(flat.every((p) => p.value === 50)).toBe(true);
  });

  it("suavizado de Wilder en datos mixtos (0 < RSI < 100)", () => {
    const out = calculateRSI(bars([10, 11, 10.5, 11.5, 11, 12, 11.5, 12.5]), { period: 3 });
    expect(out.length).toBeGreaterThan(0);
    for (const p of out) {
      expect(p.value).toBeGreaterThan(0);
      expect(p.value).toBeLessThan(100);
    }
  });
});

describe("calculateMACD", () => {
  it("fast >= slow -> invalido (vacio)", () => {
    expect(calculateMACD(bars([1, 2, 3, 4]), { fastPeriod: 4, slowPeriod: 2, signalPeriod: 2 })).toEqual([]);
  });

  it("macd = EMA(fast) - EMA(slow); histogram = macd - signal", () => {
    const data = bars([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const out = calculateMACD(data, { fastPeriod: 2, slowPeriod: 4, signalPeriod: 2 });
    expect(out.length).toBeGreaterThan(0);
    const fast = calculateEMA(data, { period: 2 });
    const slow = calculateEMA(data, { period: 4 });
    const f = new Map(fast.map((p) => [p.time, p.value]));
    for (const p of out) {
      const sv = slow.find((s) => s.time === p.time)!.value;
      expect(p.macd).toBeCloseTo(f.get(p.time)! - sv, 9);
      if (p.signal !== null) expect(p.histogram).toBeCloseTo(p.macd - p.signal, 9);
    }
  });
});
