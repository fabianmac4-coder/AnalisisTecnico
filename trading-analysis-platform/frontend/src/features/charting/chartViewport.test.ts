import { describe, it, expect } from "vitest";
import {
  adjustForNewData,
  decideViewportAction,
  viewportKey,
} from "./chartViewport";

describe("viewportKey", () => {
  it("incluye workspace, símbolo, slot y temporalidad", () => {
    expect(viewportKey(7, "aapl", "chart_2", "1Y_1D")).toBe("7:AAPL:chart_2:1Y_1D");
  });
  it("tolera c030Id/slot ausentes", () => {
    expect(viewportKey(undefined, "AAPL", undefined, "1Y_1D")).toBe("_:AAPL:_:1Y_1D");
  });
});

describe("decideViewportAction", () => {
  const r = { from: 10, to: 60 };

  it("refresh (mismo dataset) con rango vivo => conserva el rango actual", () => {
    const a = decideViewportAction({
      isFirstLoad: false,
      keyChanged: false,
      liveRange: r,
      savedRange: null,
    });
    expect(a).toEqual({ type: "restore", range: r });
  });

  it("primer load sin viewport guardado => ajusta (fit)", () => {
    const a = decideViewportAction({
      isFirstLoad: true,
      keyChanged: false,
      liveRange: null,
      savedRange: null,
    });
    expect(a).toEqual({ type: "fit" });
  });

  it("primer load con viewport guardado => restaura el guardado", () => {
    const saved = { from: 1, to: 5 };
    const a = decideViewportAction({
      isFirstLoad: true,
      keyChanged: false,
      liveRange: null,
      savedRange: saved,
    });
    expect(a).toEqual({ type: "restore", range: saved });
  });

  it("cambio de range/interval con viewport guardado => restaura el guardado", () => {
    const saved = { from: 2, to: 9 };
    const a = decideViewportAction({
      isFirstLoad: false,
      keyChanged: true,
      liveRange: r,
      savedRange: saved,
    });
    expect(a).toEqual({ type: "restore", range: saved });
  });

  it("cambio de range/interval sin viewport guardado => ajusta (fit)", () => {
    const a = decideViewportAction({
      isFirstLoad: false,
      keyChanged: true,
      liveRange: r,
      savedRange: null,
    });
    expect(a).toEqual({ type: "fit" });
  });
});

describe("adjustForNewData", () => {
  it("en el borde derecho sigue las velas nuevas (desplaza por delta)", () => {
    // to=99 con prevTotal=100 (borde); newTotal=103 => delta=3.
    const out = adjustForNewData({ from: 49, to: 99 }, 100, 103);
    expect(out).toEqual({ from: 52, to: 102 });
  });

  it("mirando histórico (no en el borde) conserva el rango", () => {
    const range = { from: 10, to: 40 };
    expect(adjustForNewData(range, 100, 103)).toEqual(range);
  });

  it("rango null => null", () => {
    expect(adjustForNewData(null, 100, 103)).toBeNull();
  });

  it("sin cambio de total conserva el rango aunque esté en el borde", () => {
    const range = { from: 50, to: 99 };
    expect(adjustForNewData(range, 100, 100)).toEqual(range);
  });
});
