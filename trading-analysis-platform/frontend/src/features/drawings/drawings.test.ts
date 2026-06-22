import { describe, it, expect } from "vitest";
import { createDrawing } from "./createDrawing";
import { getVisibleDrawingsForPanel, getDrawingOriginChartSlotId } from "./drawingFilters";
import type { Drawing } from "./drawingTypes";
import { PRESET_KEYS, type PresetKey } from "@/utils/timeframes";

/** Dibujo VIEJO sin chartSlotId (se mapea por su temporalidad histórica). */
function line(symbol: string, tf: PresetKey): Drawing {
  return createDrawing({
    symbol,
    sourceTimeframe: tf,
    type: "free_line",
    points: [
      { time: 1, price: 1 },
      { time: 2, price: 2 },
    ],
    color: "#fff",
  });
}

/** Dibujo NUEVO con chartSlotId (identidad por gráfica). */
function lineInSlot(symbol: string, slotId: string, tf: PresetKey = "1Y_1D"): Drawing {
  return createDrawing({
    symbol,
    sourceTimeframe: tf,
    type: "free_line",
    points: [
      { time: 1, price: 1 },
      { time: 2, price: 2 },
    ],
    color: "#fff",
    chartSlotId: slotId,
  });
}

describe("createDrawing (free line, v2)", () => {
  it("guarda time en ms y es global a todas las temporalidades", () => {
    const d = createDrawing({
      symbol: "aapl",
      sourceTimeframe: "1Y_1D",
      type: "free_line",
      points: [
        { time: 1717372800000, price: 190.1 },
        { time: 1717459200000, price: 195.4 },
      ],
      color: "#3b82f6",
    });
    expect(d.type).toBe("free_line");
    expect(d.symbol).toBe("AAPL");
    expect(d.points[0]).toEqual({ time: 1717372800000, price: 190.1 });
    expect(d.showOnAllTimeframes).toBe(true);
    expect(d.showOnTimeframes).toEqual([...PRESET_KEYS]);
    expect(d.style.usesTimeframeDefaultColor).toBe(true);
    expect(d.version).toBe(3);
    // Segmento FINITO: nunca extendido.
    expect(d.style.extendLeft).toBe(false);
    expect(d.style.extendRight).toBe(false);
  });

  it("dotted_line: segmento finito punteado", () => {
    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "dotted_line",
      points: [
        { time: 1, price: 1 },
        { time: 2, price: 2 },
      ],
      color: "#eab308",
    });
    expect(d.style.lineStyle).toBe("dotted");
    expect(d.style.extendLeft).toBe(false);
    expect(d.style.extendRight).toBe(false);
  });

  it("extended_trendline: recta proyectada (extend en ambos lados)", () => {
    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "4Y_1W",
      type: "extended_trendline",
      points: [
        { time: 1, price: 1 },
        { time: 2, price: 2 },
      ],
      color: "#f97316",
    });
    expect(d.style.extendLeft).toBe(true);
    expect(d.style.extendRight).toBe(true);
    expect(d.style.usesTimeframeDefaultColor).toBe(true);
  });

  it("rectangle y ellipse: zonas semitransparentes con fillOpacity", () => {
    const rect = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "rectangle",
      points: [
        { time: 1, price: 1 },
        { time: 2, price: 2 },
      ],
      color: "#3b82f6",
    });
    expect(rect.style.fillOpacity).toBe(0.12);
    expect(rect.style.opacity).toBe(0.25);

    const ell = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "ellipse",
      points: [
        { time: 1, price: 1 },
        { time: 2, price: 2 },
      ],
      color: "#3b82f6",
    });
    expect(ell.style.fillOpacity).toBe(0.1);
  });
});

describe("getVisibleDrawingsForPanel (a nivel de WORKSPACE: se replica en las 6)", () => {
  it("un dibujo del análisis se incluye sin importar su temporalidad de origen", () => {
    for (const tf of PRESET_KEYS) {
      const r = getVisibleDrawingsForPanel({ drawings: [line("AAPL", tf)], activeSymbol: "AAPL" });
      expect(r, `tf ${tf}`).toHaveLength(1);
    }
  });

  it("un dibujo creado desde chart_2 también se incluye (mismo list para todo panel)", () => {
    const d = lineInSlot("AAPL", "chart_2", "1Y_1D");
    expect(getVisibleDrawingsForPanel({ drawings: [d], activeSymbol: "AAPL" })).toHaveLength(1);
  });

  it("conserva su EstiloJSON (NO se recolorea por el panel donde se muestra)", () => {
    const orange = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "4Y_1W",
      type: "free_line",
      points: [{ time: 1, price: 1 }, { time: 2, price: 2 }],
      color: "#f97316",
      usesTimeframeDefaultColor: false,
      chartSlotId: "chart_1",
    });
    const [vis] = getVisibleDrawingsForPanel({ drawings: [orange], activeSymbol: "AAPL" });
    expect(vis.style.color).toBe("#f97316");
  });

  it("no muestra dibujos de otro símbolo", () => {
    const r = getVisibleDrawingsForPanel({
      drawings: [lineInSlot("TSLA", "chart_1")],
      activeSymbol: "AAPL",
    });
    expect(r).toHaveLength(0);
  });

  it("no muestra dibujos ocultos (visible=false)", () => {
    const d = { ...lineInSlot("AAPL", "chart_1"), visible: false };
    expect(getVisibleDrawingsForPanel({ drawings: [d], activeSymbol: "AAPL" })).toHaveLength(0);
  });

  it("oculta por GRÁFICA DE ORIGEN (hiddenOrigins) en todos los paneles", () => {
    const d1 = lineInSlot("AAPL", "chart_1");
    const d2 = lineInSlot("AAPL", "chart_2");
    const r = getVisibleDrawingsForPanel({
      drawings: [d1, d2],
      activeSymbol: "AAPL",
      hiddenOrigins: new Set(["chart_1"]),
    });
    expect(r.map((d) => d.id)).toEqual([d2.id]);
  });

  it("getDrawingOriginChartSlotId: chartSlotId o mapeo histórico de temporalidad", () => {
    expect(getDrawingOriginChartSlotId(lineInSlot("AAPL", "chart_3"))).toBe("chart_3");
    expect(getDrawingOriginChartSlotId(line("AAPL", "1W_30M"))).toBe("chart_6");
  });
});

describe("presets", () => {
  it("las seis claves de preset son unicas e incluyen 4Y_1W", () => {
    expect(new Set(PRESET_KEYS).size).toBe(6);
    expect(PRESET_KEYS).toContain("4Y_1W");
    expect(PRESET_KEYS).not.toContain("4Y_1D" as unknown as PresetKey);
  });
});
