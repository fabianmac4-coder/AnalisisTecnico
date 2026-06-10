import { describe, it, expect } from "vitest";
import {
  migrateDrawing,
  normalizeDrawingPoint,
  normalizeTimeframeKey,
} from "./drawingMigration";

describe("migrateDrawing", () => {
  it("migra sourceTimeframe 4Y_1D -> 4Y_1W", () => {
    const d = migrateDrawing({
      id: "1",
      symbol: "AAPL",
      sourceTimeframe: "4Y_1D",
      type: "trendline",
      points: [
        { time: 1, price: 1 },
        { time: 2, price: 2 },
      ],
      style: { color: "#fff", width: 1, lineStyle: "solid", opacity: 1 },
      visible: true,
      locked: false,
      showOnTimeframes: ["4Y_1D", "1Y_1D"],
      createdAt: "",
      updatedAt: "",
      version: 1,
    });
    expect(d.sourceTimeframe).toBe("4Y_1W");
    expect(d.showOnTimeframes).toEqual(["4Y_1W", "1Y_1D"]);
  });

  it("agrega showOnAllTimeframes=true y usesTimeframeDefaultColor=true si faltan", () => {
    const d = migrateDrawing({
      id: "2",
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "free_line",
      points: [],
      style: { color: "#fff", width: 1, lineStyle: "solid", opacity: 1 },
      visible: true,
      locked: false,
      createdAt: "",
      updatedAt: "",
      version: 1,
    });
    expect(d.showOnAllTimeframes).toBe(true);
    expect(d.style.usesTimeframeDefaultColor).toBe(true);
    expect(d.version).toBe(3);
  });

  it("trendline legado SIN extension -> free_line finito", () => {
    const d = migrateDrawing({
      id: "t1",
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "trendline",
      points: [
        { time: 1, price: 1 },
        { time: 2, price: 2 },
      ],
      style: { color: "#fff", width: 2, lineStyle: "solid", opacity: 1 },
      visible: true,
      locked: false,
      createdAt: "",
      updatedAt: "",
      version: 1,
    });
    expect(d.type).toBe("free_line");
    expect(d.style.extendLeft).toBe(false);
    expect(d.style.extendRight).toBe(false);
  });

  it("trendline legado CON extension -> extended_trendline", () => {
    const d = migrateDrawing({
      id: "t2",
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "trendline",
      points: [
        { time: 1, price: 1 },
        { time: 2, price: 2 },
      ],
      style: { color: "#fff", width: 2, lineStyle: "solid", opacity: 1, extendRight: true },
      visible: true,
      locked: false,
      createdAt: "",
      updatedAt: "",
      version: 1,
    });
    expect(d.type).toBe("extended_trendline");
    expect(d.style.extendLeft).toBe(true);
    expect(d.style.extendRight).toBe(true);
  });

  it("rectangle sin fillOpacity recibe el valor por defecto", () => {
    const d = migrateDrawing({
      id: "r1",
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "rectangle",
      points: [
        { time: 1, price: 1 },
        { time: 2, price: 2 },
      ],
      style: { color: "#fff", width: 1, lineStyle: "solid", opacity: 1 },
      visible: true,
      locked: false,
      createdAt: "",
      updatedAt: "",
      version: 2,
    });
    expect(d.style.fillOpacity).toBe(0.12);
    expect(d.version).toBe(3);
  });

  it("no pierde dibujos ni respeta overrides existentes", () => {
    const d = migrateDrawing({
      id: "3",
      symbol: "AAPL",
      sourceTimeframe: "6M_1D",
      type: "free_line",
      points: [],
      style: { color: "#abc", width: 2, lineStyle: "solid", opacity: 1, usesTimeframeDefaultColor: false },
      visible: true,
      locked: false,
      showOnAllTimeframes: false,
      createdAt: "",
      updatedAt: "",
      version: 2,
    });
    expect(d.style.usesTimeframeDefaultColor).toBe(false);
    expect(d.showOnAllTimeframes).toBe(false);
    expect(d.id).toBe("3");
  });

  it("normalizeTimeframeKey mapea 4Y_1D a 4Y_1W", () => {
    expect(normalizeTimeframeKey("4Y_1D")).toBe("4Y_1W");
    expect(normalizeTimeframeKey("1Y_1D")).toBe("1Y_1D");
  });

  it("puntos guardados en SEGUNDOS se convierten a milisegundos", () => {
    const d = migrateDrawing({
      id: "s1",
      symbol: "AAPL",
      sourceTimeframe: "1M_1H",
      type: "free_line",
      points: [
        { time: 1717372800, price: 190 }, // segundos (~1.7e9)
        { time: 1717459200, price: 195 },
      ],
      style: { color: "#fff", width: 2, lineStyle: "solid", opacity: 1 },
      visible: true,
      locked: false,
      createdAt: "",
      updatedAt: "",
      version: 1,
    });
    expect(d.points[0].time).toBe(1717372800000);
    expect(d.points[1].time).toBe(1717459200000);
  });

  it("puntos ya en MILISEGUNDOS quedan intactos", () => {
    const d = migrateDrawing({
      id: "s2",
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "free_line",
      points: [{ time: 1717372800000, price: 190 }],
      style: { color: "#fff", width: 2, lineStyle: "solid", opacity: 1 },
      visible: true,
      locked: false,
      createdAt: "",
      updatedAt: "",
      version: 3,
    });
    expect(d.points[0].time).toBe(1717372800000);
  });
});

describe("normalizeDrawingPoint", () => {
  it("convierte segundos a ms y respeta ms existentes", () => {
    expect(normalizeDrawingPoint({ time: 1_700_000_000, price: 1 }).time).toBe(1_700_000_000_000);
    expect(normalizeDrawingPoint({ time: 1_700_000_000_000, price: 1 }).time).toBe(
      1_700_000_000_000
    );
    expect(normalizeDrawingPoint({ time: "1700000000", price: "5" })).toEqual({
      time: 1_700_000_000_000,
      price: 5,
    });
  });
});
