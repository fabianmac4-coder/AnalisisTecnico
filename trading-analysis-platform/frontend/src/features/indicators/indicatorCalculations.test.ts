import { describe, it, expect } from "vitest";
import { sma, ema, rsi, macd, toLinePoints } from "./indicatorCalculations";
import type { Candle } from "@/features/charting/chartEngine/ChartEngineAdapter";

describe("indicadores", () => {
  it("SMA calcula la media movil y rellena con null al inicio", () => {
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBe(2); // (1+2+3)/3
    expect(out[3]).toBe(3); // (2+3+4)/3
    expect(out[4]).toBe(4); // (3+4+5)/3
  });

  it("EMA arranca con la SMA del primer bloque", () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBe(2); // SMA(1,2,3)
    expect(out[3]).toBeCloseTo(3, 5); // 4*0.5 + 2*0.5
  });

  it("RSI devuelve valores entre 0 y 100", () => {
    const values = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);
    const out = rsi(values, 14);
    const defined = out.filter((v): v is number => v !== null);
    expect(defined.length).toBeGreaterThan(0);
    for (const v of defined) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("MACD produce lineas macd, signal e histograma alineadas", () => {
    const values = Array.from({ length: 60 }, (_, i) => 100 + i);
    const { macd: m, signal, histogram } = macd(values);
    expect(m).toHaveLength(60);
    expect(signal).toHaveLength(60);
    expect(histogram).toHaveLength(60);
  });

  it("toLinePoints omite valores null y convierte ms a segundos", () => {
    const candles: Candle[] = [
      { time: 1000, open: 1, high: 1, low: 1, close: 1 },
      { time: 2000, open: 1, high: 1, low: 1, close: 2 },
    ];
    const points = toLinePoints(candles, [null, 2]);
    expect(points).toEqual([{ time: 2, value: 2 }]);
  });
});
