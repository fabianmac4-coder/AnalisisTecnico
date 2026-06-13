import { describe, it, expect } from "vitest";
import {
  contextKey,
  isSupportedCombo,
  normalizeChartSlots,
  supportedIntervalsForRange,
  slotContextKey,
  DEFAULT_CHART_SLOTS,
  type ChartSlotConfig,
} from "./chartWorkspaceTypes";

describe("chartWorkspaceTypes", () => {
  it("contextKey usa el formato range_interval", () => {
    expect(contextKey("1Y", "1h")).toBe("1Y_1h");
    expect(slotContextKey({ slotId: "chart_1", range: "5Y", interval: "1wk" })).toBe(
      "5Y_1wk"
    );
  });

  it("isSupportedCombo respeta los limites de yfinance", () => {
    expect(isSupportedCombo("1Y", "1d")).toBe(true);
    expect(isSupportedCombo("5Y", "1wk")).toBe(true);
    expect(isSupportedCombo("5Y", "1m")).toBe(false); // 1m solo hasta ~7 dias
    expect(isSupportedCombo("3M", "5m")).toBe(false); // 5m solo hasta ~60 dias
    expect(isSupportedCombo("1W", "1m")).toBe(true);
  });

  it("supportedIntervalsForRange excluye combinaciones invalidas", () => {
    const for5y = supportedIntervalsForRange("5Y");
    expect(for5y).toContain("1d");
    expect(for5y).not.toContain("1m");
    expect(for5y).not.toContain("1h"); // 1h solo hasta ~730 dias
    const for1d = supportedIntervalsForRange("1D");
    expect(for1d).toContain("1m");
  });

  it("normalizeChartSlots siempre devuelve seis slots saneados", () => {
    const slots = normalizeChartSlots([
      { slotId: "chart_1", range: "1Y", interval: "1h" },
    ]);
    expect(slots).toHaveLength(6);
    expect(slots[0]).toMatchObject({ slotId: "chart_1", range: "1Y", interval: "1h" });
    // El resto cae al default por posicion.
    expect(slots[1]).toMatchObject(DEFAULT_CHART_SLOTS[1]);
  });

  it("normalizeChartSlots sanea range/interval invalidos al default", () => {
    const bad = [
      { slotId: "chart_1", range: "99Y", interval: "7s" },
    ] as unknown as ChartSlotConfig[];
    const slots = normalizeChartSlots(bad);
    expect(slots[0].range).toBe(DEFAULT_CHART_SLOTS[0].range);
    expect(slots[0].interval).toBe(DEFAULT_CHART_SLOTS[0].interval);
  });
});
