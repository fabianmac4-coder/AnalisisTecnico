// @vitest-environment jsdom
// Render ENTRE temporalidades: el chart destino solo resuelve nativamente los
// timestamps de SUS velas/whitespace. Los puntos de dibujos creados en otra
// temporalidad deben alinearse interpolando entre las coordenadas REALES de
// las velas vecinas — nunca sobre el ancho del contenedor (eso los empujaba
// al area vacia de whitespace).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { DrawingLayer } from "./DrawingLayer";
import { createDrawing } from "./createDrawing";
import { useDrawingStore } from "@/stores/drawingStore";
import type { ChartInstance } from "@/features/charting/chartEngine/ChartEngineAdapter";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

// jsdom no calcula layout: el overlay mide 1000x500. OJO: el area de velas del
// chart simulado mide SOLO 500 px (x = tMs/2000). Si alguien volviera a
// interpolar sobre el ancho del contenedor (1000), las x saldrian al doble y
// estos tests fallarian.
Object.defineProperty(SVGElement.prototype, "clientWidth", { configurable: true, value: 1000 });
Object.defineProperty(SVGElement.prototype, "clientHeight", { configurable: true, value: 500 });

// Velas reales del chart destino: cada 100_000 ms, de 0 a 1_000_000.
const BARS = Array.from({ length: 11 }, (_, i) => ({ time: i * 100_000 }));

// Conversion nativa SOLO para los timestamps de esas velas: x = tMs / 2000.
function makeForeignTfInstance(): ChartInstance {
  const chart = {
    timeScale: () => ({
      coordinateToTime: () => null,
      timeToCoordinate: (tSec: number) => {
        const tMs = tSec * 1000;
        return tMs % 100_000 === 0 && tMs >= 0 && tMs <= 1_000_000 ? tMs / 2000 : null;
      },
    }),
  };
  const series = {
    coordinateToPrice: (y: number) => 1000 - y,
    priceToCoordinate: (p: number) => 1000 - p,
  };
  return {
    id: "foreign",
    toPixel: () => ({ x: null, y: null }),
    toMarket: () => ({ time: null, price: null }),
    onViewportChange: () => () => {},
    onClick: () => () => {},
    getContainer: () => document.createElement("div"),
    getChartApi: () => chart,
    getMainSeries: () => series,
    setInteractionEnabled: () => {},
    getVisibleTimeRangeMs: () => ({ startMs: 0, endMs: 1_000_000 }),
  } as unknown as ChartInstance;
}

beforeEach(() => {
  localStorage.clear();
  useDrawingStore.setState({
    drawingsBySymbol: {},
    activeTool: "cursor",
    selectedDrawingId: null,
  });
});
afterEach(() => cleanup());

describe("DrawingLayer entre temporalidades (alineado a velas reales)", () => {
  it("free_line con timestamps ajenos se alinea interpolando entre velas vecinas", () => {
    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "free_line",
      points: [
        { time: 250_000, price: 900 }, // entre velas 200k(x=100) y 300k(x=150)
        { time: 450_000, price: 800 }, // entre velas 400k(x=200) y 500k(x=250)
      ],
    });
    const { container } = render(
      <DrawingLayer
        instance={makeForeignTfInstance()}
        drawings={[d]}
        editable
        symbol="AAPL"
        sourceTimeframe="4Y_1W"
        candles={BARS}
      />
    );
    const line = container.querySelector("line")!;
    expect(line).toBeTruthy();
    // Interpolacion entre coordenadas de velas: 125 y 225 (sobre el ancho del
    // contenedor habria dado 250 y 450 -> fuera del area de velas).
    expect(line.getAttribute("x1")).toBe("125");
    expect(line.getAttribute("x2")).toBe("225");
    expect(line.getAttribute("y1")).toBe("100"); // 1000-900
    expect(line.getAttribute("y2")).toBe("200"); // 1000-800
  });

  it("extended_trendline se proyecta al area de velas, no al ancho del overlay", () => {
    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1W_30M",
      type: "extended_trendline",
      points: [
        { time: 250_000, price: 900 },
        { time: 450_000, price: 800 },
      ],
    });
    const { container } = render(
      <DrawingLayer
        instance={makeForeignTfInstance()}
        drawings={[d]}
        editable
        symbol="AAPL"
        sourceTimeframe="4Y_1W"
        candles={BARS}
      />
    );
    const line = container.querySelector("line")!;
    // Bordes visibles 0 y 1_000_000 son velas -> nativo: x 0 y 500 (NO 1000).
    expect(line.getAttribute("x1")).toBe("0");
    expect(line.getAttribute("x2")).toBe("500");
  });

  it("rectangle parcialmente visible se recorta y queda dentro del area de velas", () => {
    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1M_1H",
      type: "rectangle",
      points: [
        { time: 450_000, price: 900 },
        { time: 1_500_000, price: 800 }, // sobresale del rango visible
      ],
    });
    const { container } = render(
      <DrawingLayer
        instance={makeForeignTfInstance()}
        drawings={[d]}
        editable
        symbol="AAPL"
        sourceTimeframe="4Y_1W"
        candles={BARS}
      />
    );
    const rect = container.querySelector("rect")!;
    expect(rect).toBeTruthy();
    expect(rect.getAttribute("x")).toBe("225"); // 450k interpolado entre velas
    expect(rect.getAttribute("width")).toBe("275"); // hasta la ultima vela (x=500)
    expect(rect.getAttribute("y")).toBe("100"); // precio max 900
    expect(rect.getAttribute("height")).toBe("100"); // 800..900
  });

  it("segmento totalmente fuera del rango visible NO se pinta", () => {
    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1W_30M",
      type: "free_line",
      points: [
        { time: 2_000_000, price: 900 },
        { time: 3_000_000, price: 800 },
      ],
    });
    const { container } = render(
      <DrawingLayer
        instance={makeForeignTfInstance()}
        drawings={[d]}
        editable
        symbol="AAPL"
        sourceTimeframe="4Y_1W"
        candles={BARS}
      />
    );
    expect(container.querySelector("line")).toBeNull();
  });

  it("punto futuro usa el grid de whitespace; el punto historico queda alineado", () => {
    // future: ultima vela 1_000_000, paso 100_000; el chart resuelve los
    // timestamps de whitespace como si existieran (multiplos de 100k <= 1.4M).
    const inst = makeForeignTfInstance();
    const chart = {
      timeScale: () => ({
        coordinateToTime: () => null,
        timeToCoordinate: (tSec: number) => {
          const tMs = tSec * 1000;
          return tMs % 100_000 === 0 && tMs >= 0 && tMs <= 1_400_000 ? tMs / 2000 : null;
        },
      }),
    };
    (inst as unknown as { getChartApi: () => unknown }).getChartApi = () => chart;
    (inst as unknown as { getVisibleTimeRangeMs: () => unknown }).getVisibleTimeRangeMs = () => ({
      startMs: 0,
      endMs: 1_400_000,
    });

    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "free_line",
      points: [
        { time: 450_000, price: 900 }, // historico (entre velas)
        { time: 1_250_000, price: 800 }, // futuro (entre nodos de whitespace)
      ],
    });
    const { container } = render(
      <DrawingLayer
        instance={inst}
        drawings={[d]}
        editable
        symbol="AAPL"
        sourceTimeframe="1Y_1D"
        candles={BARS}
        futureInfo={{ lastBarTimeMs: 1_000_000, lastBarIndex: 10, stepMs: 100_000 }}
      />
    );
    const line = container.querySelector("line")!;
    expect(line).toBeTruthy();
    // Historico: interpolado entre velas reales -> 225 (NO desplazado por el futuro).
    expect(line.getAttribute("x1")).toBe("225");
    // Futuro: entre whitespace 1.2M(x=600) y 1.3M(x=650) -> 625.
    expect(line.getAttribute("x2")).toBe("625");
  });

  it("la goma usa radio de 6 px (circulo-preview r=6)", () => {
    useDrawingStore.setState({ activeTool: "eraser" });
    const { container } = render(
      <DrawingLayer
        instance={makeForeignTfInstance()}
        drawings={[]}
        editable
        symbol="AAPL"
        sourceTimeframe="1Y_1D"
        candles={BARS}
      />
    );
    const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 100, pointerId: 1 });
    const circle = container.querySelector("circle")!;
    expect(circle).toBeTruthy();
    expect(circle.getAttribute("r")).toBe("6");
  });
});
