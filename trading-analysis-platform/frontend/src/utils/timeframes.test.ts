import { describe, it, expect } from "vitest";
import { TIMEFRAME_PRESETS, PRESET_KEYS, getPreset, isIntraday } from "./timeframes";

describe("timeframes", () => {
  it("define exactamente las seis temporalidades en orden (4Y ahora es semanal)", () => {
    expect(PRESET_KEYS).toEqual(["4Y_1W", "1Y_1D", "6M_1D", "3M_1D", "1M_1H", "1W_30M"]);
    expect(TIMEFRAME_PRESETS).toHaveLength(6);
  });

  it("4Y usa intervalo semanal (1wk), no diario", () => {
    expect(getPreset("4Y_1W").interval).toBe("1wk");
    expect(PRESET_KEYS).not.toContain("4Y_1D");
  });

  it("usa los intervalos correctos por preset", () => {
    expect(getPreset("4Y_1W").interval).toBe("1wk");
    expect(getPreset("1M_1H").interval).toBe("1h");
    expect(getPreset("1W_30M").interval).toBe("30m");
  });

  it("marca correctamente los presets intradiarios", () => {
    expect(isIntraday("1M_1H")).toBe(true);
    expect(isIntraday("1W_30M")).toBe(true);
    expect(isIntraday("4Y_1W")).toBe(false);
    expect(isIntraday("1Y_1D")).toBe(false);
  });

  it("expone period solo donde corresponde", () => {
    expect(getPreset("1Y_1D").period).toBe("1y");
    expect(getPreset("6M_1D").period).toBe("6mo");
    expect(getPreset("3M_1D").period).toBe("3mo");
    expect(getPreset("1M_1H").period).toBe("1mo");
    // 4Y y 1W usan start/end, no period.
    expect(getPreset("4Y_1W").period).toBeUndefined();
    expect(getPreset("1W_30M").period).toBeUndefined();
  });
});
