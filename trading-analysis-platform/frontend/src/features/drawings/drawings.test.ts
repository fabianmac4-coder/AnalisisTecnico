import { describe, it, expect } from "vitest";
import { createDrawing } from "./createDrawing";
import { getVisibleDrawingsForPanel, type DrawingVisibilityFilters } from "./drawingFilters";
import type { Drawing } from "./drawingTypes";
import { PRESET_KEYS, type PresetKey } from "@/utils/timeframes";

const allVisible: DrawingVisibilityFilters = PRESET_KEYS.reduce(
  (acc, k) => ({ ...acc, [k]: true }),
  {} as DrawingVisibilityFilters
);

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

describe("getVisibleDrawingsForPanel (dibujos globales)", () => {
  it("un dibujo creado en 4Y_1W aparece en el panel 1Y_1D", () => {
    const d = line("AAPL", "4Y_1W");
    const r = getVisibleDrawingsForPanel({
      drawings: [d],
      activeSymbol: "AAPL",
      panelTimeframe: "1Y_1D",
      visibilityFilters: allVisible,
    });
    expect(r).toHaveLength(1);
  });

  it("un dibujo creado en 1W_30M aparece en el panel 4Y_1W", () => {
    const d = line("AAPL", "1W_30M");
    const r = getVisibleDrawingsForPanel({
      drawings: [d],
      activeSymbol: "AAPL",
      panelTimeframe: "4Y_1W",
      visibilityFilters: allVisible,
    });
    expect(r).toHaveLength(1);
  });

  it("apagar el filtro 4Y_1W oculta sus dibujos en TODOS los paneles", () => {
    const d = line("AAPL", "4Y_1W");
    const filters = { ...allVisible, "4Y_1W": false };
    for (const panel of PRESET_KEYS) {
      const r = getVisibleDrawingsForPanel({
        drawings: [d],
        activeSymbol: "AAPL",
        panelTimeframe: panel,
        visibilityFilters: filters,
      });
      expect(r).toHaveLength(0);
    }
  });

  it("volver a encender 4Y_1W muestra los dibujos otra vez", () => {
    const d = line("AAPL", "4Y_1W");
    const r = getVisibleDrawingsForPanel({
      drawings: [d],
      activeSymbol: "AAPL",
      panelTimeframe: "6M_1D",
      visibilityFilters: { ...allVisible, "4Y_1W": true },
    });
    expect(r).toHaveLength(1);
  });

  it("no muestra dibujos de otro simbolo", () => {
    const d = line("TSLA", "1Y_1D");
    const r = getVisibleDrawingsForPanel({
      drawings: [d],
      activeSymbol: "AAPL",
      panelTimeframe: "1Y_1D",
      visibilityFilters: allVisible,
    });
    expect(r).toHaveLength(0);
  });

  it("showOnAllTimeframes AUSENTE cuenta como true (datos viejos)", () => {
    const d = line("AAPL", "1M_1H");
    delete (d as Partial<Drawing>).showOnAllTimeframes;
    for (const panel of PRESET_KEYS) {
      const r = getVisibleDrawingsForPanel({
        drawings: [d],
        activeSymbol: "AAPL",
        panelTimeframe: panel,
        visibilityFilters: allVisible,
      });
      expect(r).toHaveLength(1);
    }
  });

  it("dibujos de 1Y_1D/6M_1D/1W_30M son elegibles en el panel 4Y_1W", () => {
    for (const src of ["1Y_1D", "6M_1D", "1W_30M"] as PresetKey[]) {
      const r = getVisibleDrawingsForPanel({
        drawings: [line("AAPL", src)],
        activeSymbol: "AAPL",
        panelTimeframe: "4Y_1W",
        visibilityFilters: allVisible,
      });
      expect(r, `desde ${src}`).toHaveLength(1);
    }
  });

  it("no muestra dibujos ocultos (visible=false)", () => {
    const d = { ...line("AAPL", "1Y_1D"), visible: false };
    const r = getVisibleDrawingsForPanel({
      drawings: [d],
      activeSymbol: "AAPL",
      panelTimeframe: "1Y_1D",
      visibilityFilters: allVisible,
    });
    expect(r).toHaveLength(0);
  });
});

describe("presets", () => {
  it("las seis claves de preset son unicas e incluyen 4Y_1W", () => {
    expect(new Set(PRESET_KEYS).size).toBe(6);
    expect(PRESET_KEYS).toContain("4Y_1W");
    expect(PRESET_KEYS).not.toContain("4Y_1D" as unknown as PresetKey);
  });
});
