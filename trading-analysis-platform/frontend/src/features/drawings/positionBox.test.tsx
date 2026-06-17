// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { DrawingToolbar } from "./DrawingToolbar";
import { createDrawing } from "./createDrawing";
import { defaultPositionPrices } from "./positionBoxCalculations";
import { getVisibleDrawingsForPanel } from "./drawingFilters";
import { useDrawingStore } from "@/stores/drawingStore";

beforeEach(() => {
  useDrawingStore.setState({ activeTool: "cursor", selectedDrawingId: null });
});
afterEach(() => cleanup());

describe("DrawingToolbar — herramientas de plan de posición", () => {
  it("muestra los botones Posición Long y Short", () => {
    render(<DrawingToolbar />);
    expect(screen.getByTitle(/Plan de posición Long/)).toBeTruthy();
    expect(screen.getByTitle(/Plan de posición Short/)).toBeTruthy();
  });

  it("clic en Long activa la herramienta LONG_POSITION", () => {
    render(<DrawingToolbar />);
    fireEvent.click(screen.getByTitle(/Plan de posición Long/));
    expect(useDrawingStore.getState().activeTool).toBe("LONG_POSITION");
  });

  it("clic en Short activa la herramienta SHORT_POSITION", () => {
    render(<DrawingToolbar />);
    fireEvent.click(screen.getByTitle(/Plan de posición Short/));
    expect(useDrawingStore.getState().activeTool).toBe("SHORT_POSITION");
  });
});

describe("createDrawing — caja de posición aislada por temporalidad", () => {
  it("LONG: defaults target>entry>stop, aislada al timeframe, con datos position", () => {
    const entry = 100;
    const { targetPrice, stopPrice } = defaultPositionPrices("LONG_POSITION", entry);
    const d = createDrawing({
      symbol: "aapl",
      c030Id: 7,
      sourceTimeframe: "1Y_1D",
      type: "LONG_POSITION",
      points: [
        { time: 1_000, price: entry },
        { time: 2_000, price: targetPrice },
        { time: 2_000, price: stopPrice },
      ],
      position: {
        toolType: "LONG_POSITION",
        quantity: 1,
        fees: 0,
        accountCurrency: "USD",
        chartContextKey: "1Y_1D",
      },
    });
    expect(d.type).toBe("LONG_POSITION");
    expect(d.symbol).toBe("AAPL");
    expect(d.points[1].price).toBeGreaterThan(d.points[0].price); // target > entry
    expect(d.points[0].price).toBeGreaterThan(d.points[2].price); // entry > stop
    // No debe filtrarse a otras temporalidades.
    expect(d.showOnAllTimeframes).toBe(false);
    expect(d.showOnTimeframes).toEqual(["1Y_1D"]);
    expect(d.style.position?.quantity).toBe(1);
    expect(d.style.position?.chartContextKey).toBe("1Y_1D");
    expect(d.c030Id).toBe(7);
  });

  it("SHORT: defaults stop>entry>target y aislada a su temporalidad", () => {
    const entry = 100;
    const { targetPrice, stopPrice } = defaultPositionPrices("SHORT_POSITION", entry);
    const d = createDrawing({
      symbol: "MSFT",
      sourceTimeframe: "6M_1D",
      type: "SHORT_POSITION",
      points: [
        { time: 1_000, price: entry },
        { time: 2_000, price: targetPrice },
        { time: 2_000, price: stopPrice },
      ],
      position: { toolType: "SHORT_POSITION", quantity: 1 },
    });
    expect(d.points[2].price).toBeGreaterThan(d.points[0].price); // stop > entry
    expect(d.points[0].price).toBeGreaterThan(d.points[1].price); // entry > target
    expect(d.showOnAllTimeframes).toBe(false);
    expect(d.showOnTimeframes).toEqual(["6M_1D"]);
  });
});

describe("getVisibleDrawingsForPanel — la caja NO se filtra a otras temporalidades", () => {
  const box = createDrawing({
    symbol: "AAPL",
    sourceTimeframe: "1Y_1D",
    type: "LONG_POSITION",
    points: [
      { time: 1_000, price: 100 },
      { time: 2_000, price: 105 },
      { time: 2_000, price: 97 },
    ],
    position: { toolType: "LONG_POSITION", quantity: 1 },
  });

  it("visible en su propia temporalidad (1Y_1D)", () => {
    const vis = getVisibleDrawingsForPanel({
      drawings: [box],
      activeSymbol: "AAPL",
      panelTimeframe: "1Y_1D",
      visibilityFilters: {},
    });
    expect(vis.map((d) => d.id)).toEqual([box.id]);
  });

  it("NO visible en otra temporalidad (6M_1D)", () => {
    const vis = getVisibleDrawingsForPanel({
      drawings: [box],
      activeSymbol: "AAPL",
      panelTimeframe: "6M_1D",
      visibilityFilters: {},
    });
    expect(vis).toEqual([]);
  });
});
