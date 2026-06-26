import { describe, it, expect } from "vitest";
import {
  defaultReplayCursor,
  filterBarsToCursor,
  intervalToMinutes,
  lastBarAtOrBefore,
  nextReplayTime,
  prevReplayTime,
  replayStepMs,
} from "./replayUtils";
import type { Candle } from "@/features/charting/chartEngine/ChartEngineAdapter";

function bars(times: number[]): Candle[] {
  return times.map((t, i) => ({
    time: t,
    open: i,
    high: i + 1,
    low: i - 1,
    close: i + 0.5,
    volume: 100,
  }));
}

describe("filterBarsToCursor", () => {
  it("oculta las velas posteriores al cursor (<=)", () => {
    const b = bars([1, 2, 3, 4, 5]);
    const out = filterBarsToCursor(b, 3);
    expect(out.map((x) => x.time)).toEqual([1, 2, 3]);
  });

  it("cursor null => todas las velas (sin recorte)", () => {
    const b = bars([1, 2, 3]);
    expect(filterBarsToCursor(b, null)).toHaveLength(3);
  });

  it("no muta el arreglo original", () => {
    const b = bars([1, 2, 3]);
    filterBarsToCursor(b, 1);
    expect(b).toHaveLength(3);
  });
});

describe("nextReplayTime / prevReplayTime", () => {
  const times = [10, 20, 30, 40];
  it("nextReplayTime devuelve el siguiente tiempo mayor", () => {
    expect(nextReplayTime(times, 20)).toBe(30);
    expect(nextReplayTime(times, 40)).toBeNull(); // ya en el último
    expect(nextReplayTime(times, null)).toBe(40); // null => último
  });
  it("prevReplayTime devuelve el tiempo anterior", () => {
    expect(prevReplayTime(times, 30)).toBe(20);
    expect(prevReplayTime(times, 10)).toBeNull(); // ya en el primero
    expect(prevReplayTime(times, null)).toBeNull();
  });
});

describe("defaultReplayCursor", () => {
  it("deja revealCount velas ocultas al final", () => {
    const times = Array.from({ length: 100 }, (_, i) => i);
    expect(defaultReplayCursor(times, 20)).toBe(79); // índice 100-1-20
  });
  it("series corta => primer tiempo", () => {
    expect(defaultReplayCursor([5, 6], 20)).toBe(5);
  });
  it("vacío => null", () => {
    expect(defaultReplayCursor([], 20)).toBeNull();
  });
});

describe("lastBarAtOrBefore", () => {
  it("última vela con time <= cursor", () => {
    const b = bars([1, 2, 3, 4]);
    expect(lastBarAtOrBefore(b, 3)?.time).toBe(3);
    expect(lastBarAtOrBefore(b, null)?.time).toBe(4);
  });
});

describe("intervalToMinutes / replayStepMs", () => {
  it("ordena temporalidades de fina a gruesa", () => {
    expect(intervalToMinutes("1m")).toBeLessThan(intervalToMinutes("5m"));
    expect(intervalToMinutes("30m")).toBeLessThan(intervalToMinutes("1h"));
    expect(intervalToMinutes("1d")).toBeLessThan(intervalToMinutes("1wk"));
  });
  it("a mayor velocidad, menor intervalo entre pasos", () => {
    expect(replayStepMs(2)).toBeLessThan(replayStepMs(1));
    expect(replayStepMs(10)).toBeLessThanOrEqual(replayStepMs(5));
    expect(replayStepMs(1000)).toBeGreaterThanOrEqual(200); // piso de seguridad
  });
});
