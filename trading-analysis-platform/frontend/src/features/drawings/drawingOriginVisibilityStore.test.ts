// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  useDrawingOriginVisibilityStore,
  originVisKey,
} from "./drawingOriginVisibilityStore";

beforeEach(() => {
  localStorage.clear();
  useDrawingOriginVisibilityStore.setState({ hidden: {} });
});

describe("drawingOriginVisibilityStore — ocultar/mostrar por gráfica de origen", () => {
  it("toggle marca y desmarca una gráfica como oculta", () => {
    const s = useDrawingOriginVisibilityStore.getState();
    expect(s.isHidden(7, "AAPL", "chart_1")).toBe(false);
    s.toggle(7, "AAPL", "chart_1");
    expect(useDrawingOriginVisibilityStore.getState().isHidden(7, "AAPL", "chart_1")).toBe(true);
    useDrawingOriginVisibilityStore.getState().toggle(7, "AAPL", "chart_1");
    expect(useDrawingOriginVisibilityStore.getState().isHidden(7, "AAPL", "chart_1")).toBe(false);
  });

  it("se acota por workspace + símbolo + gráfica", () => {
    const s = useDrawingOriginVisibilityStore.getState();
    s.toggle(7, "AAPL", "chart_1");
    const g = useDrawingOriginVisibilityStore.getState();
    expect(g.isHidden(7, "AAPL", "chart_1")).toBe(true);
    expect(g.isHidden(7, "AAPL", "chart_2")).toBe(false); // otra gráfica
    expect(g.isHidden(9, "AAPL", "chart_1")).toBe(false); // otro workspace
    expect(g.isHidden(7, "TSLA", "chart_1")).toBe(false); // otro símbolo
  });

  it("la clave es `${c030Id}:${SYMBOL}:${slot}`", () => {
    expect(originVisKey(7, "aapl", "chart_3")).toBe("7:AAPL:chart_3");
    expect(originVisKey(undefined, "AAPL", "chart_1")).toBe("_:AAPL:chart_1");
  });

  it("persiste en localStorage", () => {
    useDrawingOriginVisibilityStore.getState().toggle(7, "AAPL", "chart_1");
    const raw = localStorage.getItem("tradingPlatform.drawingOriginVisibility");
    expect(raw).toBeTruthy();
    expect(raw).toContain("7:AAPL:chart_1");
  });
});
