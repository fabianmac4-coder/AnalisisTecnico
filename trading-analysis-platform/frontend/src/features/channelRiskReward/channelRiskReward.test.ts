// Tests de la matematica PURA del R/R de canal (tiempos en ms, como en SQL).
import { describe, it, expect } from "vitest";
import { computeChannelRiskReward, getLinePriceAtTime } from "./channelRiskRewardMath";
import type { ChannelLine } from "./channelRiskRewardTypes";

const DAY = 86_400_000;

// Linea de 100 a 110 en 10 dias => +1 por dia.
const RISING: ChannelLine = {
  drawingId: "u1",
  time1: 0,
  price1: 100,
  time2: 10 * DAY,
  price2: 110,
};

describe("getLinePriceAtTime", () => {
  it("interpola dentro del segmento", () => {
    expect(getLinePriceAtTime(RISING, 5 * DAY)).toBeCloseTo(105, 6);
  });

  it("extrapola fuera del segmento (futuro y pasado)", () => {
    expect(getLinePriceAtTime(RISING, 15 * DAY)).toBeCloseTo(115, 6);
    expect(getLinePriceAtTime(RISING, -5 * DAY)).toBeCloseTo(95, 6);
  });

  it("linea vertical degenerada devuelve price1", () => {
    expect(
      getLinePriceAtTime({ drawingId: "x", time1: 5, price1: 42, time2: 5, price2: 99 }, 123)
    ).toBe(42);
  });
});

describe("computeChannelRiskReward", () => {
  // Canal paralelo: superior 15 puntos arriba de la inferior.
  const upper: ChannelLine = { ...RISING, drawingId: "up", price1: 110, price2: 120 };
  const lower: ChannelLine = { ...RISING, drawingId: "low", price1: 95, price2: 105 };

  it("calcula reward/risk/ratio correctos (ejemplo del spec)", () => {
    // En t=5d: superior=115, inferior=100... usamos referencia 100 con
    // inferior en 95 => reward 15, risk 5, ratio 3.
    const result = computeChannelRiskReward(
      { drawingId: "up", time1: 0, price1: 115, time2: DAY, price2: 115 },
      { drawingId: "low", time1: 0, price1: 95, time2: DAY, price2: 95 },
      100,
      DAY / 2,
      "current_price"
    );
    expect(result.upperChannelPrice).toBe(115);
    expect(result.lowerChannelPrice).toBe(95);
    expect(result.potentialRewardPercent).toBeCloseTo(15, 2);
    expect(result.potentialRiskPercent).toBeCloseTo(5, 2);
    expect(result.ratio).toBeCloseTo(3.0, 2);
    expect(result.invalidReason).toBeNull();
  });

  it("canal paralelo: precios superior/inferior correctos en el tiempo objetivo", () => {
    const result = computeChannelRiskReward(upper, lower, 105, 5 * DAY, "current_price");
    expect(result.upperChannelPrice).toBeCloseTo(115, 4);
    expect(result.lowerChannelPrice).toBeCloseTo(100, 4);
    expect(result.ratio).toBeCloseTo((115 - 105) / (105 - 100), 2);
  });

  it("intercambia automaticamente si superior < inferior", () => {
    const result = computeChannelRiskReward(lower, upper, 105, 5 * DAY, "current_price");
    expect(result.upperChannelPrice).toBeCloseTo(115, 4);
    expect(result.lowerChannelPrice).toBeCloseTo(100, 4);
  });

  it("reward <= 0: referencia en o sobre el canal superior", () => {
    const result = computeChannelRiskReward(upper, lower, 120, 5 * DAY, "current_price");
    expect(result.ratio).toBeNull();
    expect(result.invalidReason).toContain("reward");
  });

  it("risk <= 0: referencia en o bajo el canal inferior", () => {
    const result = computeChannelRiskReward(upper, lower, 99, 5 * DAY, "simulated_entry");
    expect(result.ratio).toBeNull();
    expect(result.invalidReason).toContain("riesgo");
    expect(result.referenceType).toBe("simulated_entry");
  });
});
