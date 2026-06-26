import { describe, it, expect, beforeEach } from "vitest";
import { useChartViewportStore } from "./chartViewportStore";

beforeEach(() => useChartViewportStore.setState({ ranges: {} }));

describe("chartViewportStore", () => {
  it("guarda y recupera el rango por clave", () => {
    useChartViewportStore.getState().setRange("k1", { from: 10, to: 60 });
    expect(useChartViewportStore.getState().getRange("k1")).toEqual({ from: 10, to: 60 });
    expect(useChartViewportStore.getState().getRange("otra")).toBeNull();
  });

  it("claves distintas no se pisan (panel vs maximizado de otro slot)", () => {
    useChartViewportStore.getState().setRange("7:AAPL:chart_2:1Y_1D", { from: 1, to: 2 });
    useChartViewportStore.getState().setRange("7:AAPL:chart_3:6M_1D", { from: 3, to: 4 });
    expect(useChartViewportStore.getState().getRange("7:AAPL:chart_2:1Y_1D")).toEqual({ from: 1, to: 2 });
    expect(useChartViewportStore.getState().getRange("7:AAPL:chart_3:6M_1D")).toEqual({ from: 3, to: 4 });
  });

  it("clearRange elimina la entrada", () => {
    useChartViewportStore.getState().setRange("k1", { from: 1, to: 2 });
    useChartViewportStore.getState().clearRange("k1");
    expect(useChartViewportStore.getState().getRange("k1")).toBeNull();
  });
});
