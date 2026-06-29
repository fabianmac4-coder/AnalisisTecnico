import { describe, it, expect } from "vitest";
import {
  formatDrawingPrice,
  isEndpointVisible,
  shouldShowPriceLabels,
} from "./drawingPriceLabel";
import { createDrawing } from "./createDrawing";

function decimals(s: string): number {
  const parts = s.split(/[.,]/);
  return parts.length > 1 ? parts[1].length : 0;
}

describe("formatDrawingPrice", () => {
  it("acciones (>=1) => 2 decimales", () => {
    expect(decimals(formatDrawingPrice(970))).toBe(2);
    expect(decimals(formatDrawingPrice(184.256))).toBe(2);
    expect(formatDrawingPrice(970)).toMatch(/^970[.,]00$/);
  });
  it("precios <1 => 4 decimales", () => {
    expect(decimals(formatDrawingPrice(0.5))).toBe(4);
  });
  it("precios <0.01 => 6 decimales", () => {
    expect(decimals(formatDrawingPrice(0.005))).toBe(6);
  });
  it("valor no finito => cadena vacía (no crashea)", () => {
    expect(formatDrawingPrice(NaN)).toBe("");
    expect(formatDrawingPrice(Infinity)).toBe("");
  });
});

describe("shouldShowPriceLabels", () => {
  const line = createDrawing({
    symbol: "AAPL",
    sourceTimeframe: "1Y_1D",
    type: "free_line",
    points: [
      { time: 1, price: 100 },
      { time: 2, price: 110 },
    ],
  });

  it("línea con la preferencia global activa => true", () => {
    expect(shouldShowPriceLabels(line, true)).toBe(true);
  });
  it("preferencia global desactivada => false", () => {
    expect(shouldShowPriceLabels(line, false)).toBe(false);
  });
  it("override por dibujo (showEndpointPriceLabels=false) => false", () => {
    const off = { ...line, style: { ...line.style, showEndpointPriceLabels: false } };
    expect(shouldShowPriceLabels(off, true)).toBe(false);
  });
  it("rectángulo (no es línea) => false", () => {
    const rect = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "rectangle",
      points: [
        { time: 1, price: 100 },
        { time: 2, price: 110 },
      ],
    });
    expect(shouldShowPriceLabels(rect, true)).toBe(false);
  });

  it("línea horizontal (horizontalLock) => SIEMPRE true, aunque la global esté off", () => {
    const horiz = {
      ...line,
      style: { ...line.style, horizontalLock: true },
    };
    expect(shouldShowPriceLabels(horiz, false)).toBe(true);
    expect(shouldShowPriceLabels(horiz, true)).toBe(true);
  });
});

describe("isEndpointVisible", () => {
  it("dentro del área visible => true", () => {
    expect(isEndpointVisible({ x: 50, y: 30 }, { w: 300, h: 200 })).toBe(true);
  });
  it("fuera del área (x negativo o y > alto) => false", () => {
    expect(isEndpointVisible({ x: -20, y: 30 }, { w: 300, h: 200 })).toBe(false);
    expect(isEndpointVisible({ x: 50, y: 999 }, { w: 300, h: 200 })).toBe(false);
  });
  it("panel sin medir (size 0) => true (no filtra)", () => {
    expect(isEndpointVisible({ x: 50, y: 30 }, { w: 0, h: 0 })).toBe(true);
  });
});
