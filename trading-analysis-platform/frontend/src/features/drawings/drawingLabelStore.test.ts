import { describe, it, expect, beforeEach } from "vitest";
import { useDrawingLabelStore } from "./drawingLabelStore";

beforeEach(() => useDrawingLabelStore.setState({ showPriceLabels: true }));

describe("drawingLabelStore", () => {
  it("activado por defecto", () => {
    expect(useDrawingLabelStore.getState().showPriceLabels).toBe(true);
  });
  it("toggle alterna la preferencia", () => {
    useDrawingLabelStore.getState().toggle();
    expect(useDrawingLabelStore.getState().showPriceLabels).toBe(false);
    useDrawingLabelStore.getState().toggle();
    expect(useDrawingLabelStore.getState().showPriceLabels).toBe(true);
  });
  it("setShowPriceLabels fija el valor", () => {
    useDrawingLabelStore.getState().setShowPriceLabels(false);
    expect(useDrawingLabelStore.getState().showPriceLabels).toBe(false);
  });
});
