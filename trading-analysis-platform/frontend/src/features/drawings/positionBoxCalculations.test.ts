import { describe, it, expect } from "vitest";
import { calcPositionBox, defaultPositionPrices } from "./positionBoxCalculations";

describe("calcPositionBox — LONG", () => {
  it("calcula riesgo/recompensa/ratio correctamente", () => {
    const m = calcPositionBox({
      type: "LONG_POSITION", entryPrice: 100, targetPrice: 120, stopPrice: 90, quantity: 10,
    });
    expect(m.isValid).toBe(true);
    expect(m.riskPerShare).toBe(10); // 100 - 90
    expect(m.rewardPerShare).toBe(20); // 120 - 100
    expect(m.riskAmount).toBe(100); // 10 * 10
    expect(m.rewardAmount).toBe(200); // 20 * 10
    expect(m.riskPercent).toBe(10); // 10/100
    expect(m.rewardPercent).toBe(20);
    expect(m.riskRewardRatio).toBe(2); // 20/10
    expect(m.targetPnL).toBe(200);
    expect(m.stopPnL).toBe(-100);
  });

  it("aplica fees al riesgo (+) y recompensa (-)", () => {
    const m = calcPositionBox({
      type: "LONG_POSITION", entryPrice: 100, targetPrice: 120, stopPrice: 90, quantity: 10, fees: 5,
    });
    expect(m.riskAmount).toBe(105);
    expect(m.rewardAmount).toBe(195);
  });

  it("geometría inválida (stop > entry) marca isValid=false sin lanzar", () => {
    const m = calcPositionBox({
      type: "LONG_POSITION", entryPrice: 100, targetPrice: 120, stopPrice: 110, quantity: 10,
    });
    expect(m.isValid).toBe(false);
    expect(m.validationMessage).toMatch(/objetivo > entrada > stop/);
  });
});

describe("calcPositionBox — SHORT", () => {
  it("calcula riesgo/recompensa/ratio correctamente", () => {
    const m = calcPositionBox({
      type: "SHORT_POSITION", entryPrice: 100, targetPrice: 80, stopPrice: 110, quantity: 10,
    });
    expect(m.isValid).toBe(true);
    expect(m.riskPerShare).toBe(10); // 110 - 100
    expect(m.rewardPerShare).toBe(20); // 100 - 80
    expect(m.riskRewardRatio).toBe(2);
    expect(m.riskAmount).toBe(100);
    expect(m.rewardAmount).toBe(200);
  });

  it("geometría inválida (target > entry) marca isValid=false", () => {
    const m = calcPositionBox({
      type: "SHORT_POSITION", entryPrice: 100, targetPrice: 120, stopPrice: 110, quantity: 10,
    });
    expect(m.isValid).toBe(false);
    expect(m.validationMessage).toMatch(/stop > entrada > objetivo/);
  });
});

describe("calcPositionBox — guards", () => {
  it("cantidad 0 -> inválido, no divide por cero", () => {
    const m = calcPositionBox({
      type: "LONG_POSITION", entryPrice: 100, targetPrice: 120, stopPrice: 90, quantity: 0,
    });
    expect(m.isValid).toBe(false);
    expect(Number.isFinite(m.riskAmount)).toBe(true);
  });

  it("editar la cantidad cambia los montos pero no el ratio", () => {
    const base = { type: "LONG_POSITION" as const, entryPrice: 100, targetPrice: 120, stopPrice: 90 };
    const a = calcPositionBox({ ...base, quantity: 10 });
    const b = calcPositionBox({ ...base, quantity: 50 });
    expect(b.riskAmount).toBe(a.riskAmount * 5);
    expect(b.riskRewardRatio).toBe(a.riskRewardRatio);
  });
});

describe("defaultPositionPrices", () => {
  it("LONG: target arriba, stop abajo", () => {
    const d = defaultPositionPrices("LONG_POSITION", 100);
    expect(d.targetPrice).toBeGreaterThan(100);
    expect(d.stopPrice).toBeLessThan(100);
  });
  it("SHORT: target abajo, stop arriba", () => {
    const d = defaultPositionPrices("SHORT_POSITION", 100);
    expect(d.targetPrice).toBeLessThan(100);
    expect(d.stopPrice).toBeGreaterThan(100);
  });
});
