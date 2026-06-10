import { describe, it, expect } from "vitest";
import {
  createFutureWhitespace,
  FUTURE_WHITESPACE_COUNT,
  PRESET_STEP_MS,
} from "./futureWhitespace";
import { PRESET_KEYS } from "@/utils/timeframes";

describe("createFutureWhitespace", () => {
  it("genera la cantidad configurada para cada preset", () => {
    for (const preset of PRESET_KEYS) {
      const times = createFutureWhitespace({ lastTimeMs: 1_700_000_000_000, preset });
      expect(times).toHaveLength(FUTURE_WHITESPACE_COUNT[preset]);
    }
  });

  it("los tiempos son ms ascendentes con el paso del preset", () => {
    const last = 1_700_000_000_000;
    const times = createFutureWhitespace({ lastTimeMs: last, preset: "1Y_1D", count: 3 });
    expect(times).toEqual([
      last + PRESET_STEP_MS["1Y_1D"],
      last + 2 * PRESET_STEP_MS["1Y_1D"],
      last + 3 * PRESET_STEP_MS["1Y_1D"],
    ]);
  });

  it("4Y_1W avanza en semanas; 1W_30M en 30 minutos", () => {
    const last = 1_700_000_000_000;
    const weekly = createFutureWhitespace({ lastTimeMs: last, preset: "4Y_1W", count: 1 });
    expect(weekly[0] - last).toBe(7 * 24 * 3600 * 1000);
    const m30 = createFutureWhitespace({ lastTimeMs: last, preset: "1W_30M", count: 1 });
    expect(m30[0] - last).toBe(30 * 60 * 1000);
  });

  it("son solo tiempos (numeros), sin OHLC falso", () => {
    const times = createFutureWhitespace({ lastTimeMs: 1, preset: "3M_1D", count: 5 });
    for (const t of times) expect(typeof t).toBe("number");
  });

  it("lastTimeMs invalido -> vacio", () => {
    expect(createFutureWhitespace({ lastTimeMs: NaN, preset: "1Y_1D" })).toEqual([]);
  });
});
