import { describe, it, expect } from "vitest";
import { DEFAULT_TIMEFRAME_DRAWING_COLORS, resolveDrawingColor } from "./colors";
import { createDrawing } from "./createDrawing";

describe("colores por temporalidad", () => {
  it("un dibujo nuevo usa el color por defecto de su temporalidad", () => {
    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "4Y_1W",
      type: "free_line",
      points: [
        { time: 1, price: 1 },
        { time: 2, price: 2 },
      ],
      color: DEFAULT_TIMEFRAME_DRAWING_COLORS["4Y_1W"],
    });
    expect(d.style.usesTimeframeDefaultColor).toBe(true);
    expect(resolveDrawingColor(d, DEFAULT_TIMEFRAME_DRAWING_COLORS)).toBe(
      DEFAULT_TIMEFRAME_DRAWING_COLORS["4Y_1W"]
    );
  });

  it("cambiar el color de 4Y_1W actualiza los dibujos que usan color de temporalidad", () => {
    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "4Y_1W",
      type: "free_line",
      points: [
        { time: 1, price: 1 },
        { time: 2, price: 2 },
      ],
      color: "#f97316",
    });
    const newColors = { ...DEFAULT_TIMEFRAME_DRAWING_COLORS, "4Y_1W": "#123456" };
    expect(resolveDrawingColor(d, newColors)).toBe("#123456");
  });

  it("un dibujo con color propio (override) no se sobreescribe", () => {
    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "free_line",
      points: [
        { time: 1, price: 1 },
        { time: 2, price: 2 },
      ],
    });
    // Sin color en params => usesTimeframeDefaultColor false, color propio.
    d.style.usesTimeframeDefaultColor = false;
    d.style.color = "#abcdef";
    const newColors = { ...DEFAULT_TIMEFRAME_DRAWING_COLORS, "1Y_1D": "#000000" };
    expect(resolveDrawingColor(d, newColors)).toBe("#abcdef");
  });

  it("un dibujo con estilo de PANEL fija su color (no depende del timeframe)", () => {
    // createDrawing con usesTimeframeDefaultColor:false => color FIJO del panel.
    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "free_line",
      points: [
        { time: 1, price: 1 },
        { time: 2, price: 2 },
      ],
      color: "#f97316", // naranja elegido en el panel
      usesTimeframeDefaultColor: false,
    });
    expect(d.style.usesTimeframeDefaultColor).toBe(false);
    expect(d.style.color).toBe("#f97316");
    // Aunque cambie el color de la temporalidad 1Y_1D, el dibujo sigue naranja.
    const newColors = { ...DEFAULT_TIMEFRAME_DRAWING_COLORS, "1Y_1D": "#000000" };
    expect(resolveDrawingColor(d, newColors)).toBe("#f97316");
  });
});
