// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { DrawingLayer } from "./DrawingLayer";
import { createDrawing } from "./createDrawing";
import { useDrawingStore } from "@/stores/drawingStore";
import type { ChartInstance } from "@/features/charting/chartEngine/ChartEngineAdapter";

// jsdom no implementa ResizeObserver; stub minimo para el overlay.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

// Chart simulado: coordinateToTime(x) = x (segundos), coordinateToPrice(y)=1000-y.
// Asi un pixel (x,y) -> { time: x*1000 ms, price: 1000-y }.
function makeFakeInstance(): ChartInstance {
  const chart = {
    timeScale: () => ({
      coordinateToTime: (x: number) => x,
      timeToCoordinate: (t: number) => t,
    }),
  };
  const series = {
    coordinateToPrice: (y: number) => 1000 - y,
    priceToCoordinate: (p: number) => 1000 - p,
  };
  return {
    id: "test",
    toPixel: () => ({ x: null, y: null }),
    toMarket: () => ({ time: null, price: null }),
    onViewportChange: () => () => {},
    onClick: () => () => {},
    getContainer: () => document.createElement("div"),
    getChartApi: () => chart,
    getMainSeries: () => series,
    setInteractionEnabled: () => {},
    // null -> el render usa los puntos originales (sin proyeccion) en el test.
    getVisibleTimeRangeMs: () => null,
  } as unknown as ChartInstance;
}

beforeEach(() => {
  localStorage.clear();
  useDrawingStore.setState({
    drawingsBySymbol: {},
    activeTool: "free_line",
    selectedDrawingId: null,
  });
});
afterEach(() => cleanup());

describe("DrawingLayer (Free Line, end-to-end)", () => {
  it("dos clicks crean una linea libre y la persisten en coordenadas de mercado", async () => {
    const inst = makeFakeInstance();
    const { container } = render(
      <DrawingLayer
        instance={inst}
        drawings={[]}
        editable
        symbol="AAPL"
        sourceTimeframe="1Y_1D"
      />
    );
    const svg = container.querySelector("svg.drawing-overlay")!;
    expect(svg).toBeTruthy();

    // Primer click (punto A), movimiento (preview), segundo click (punto B).
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerDown(svg, { clientX: 80, clientY: 60, pointerId: 1 });

    await waitFor(() => {
      const raw = localStorage.getItem("tap.drawings.v1");
      expect(raw).toBeTruthy();
      const data = JSON.parse(raw!);
      expect(data.AAPL).toHaveLength(1);
      const d = data.AAPL[0];
      expect(d.type).toBe("free_line");
      expect(d.points).toHaveLength(2);
      // time guardado en ms (x segundos * 1000); price = 1000 - y.
      expect(d.points[0]).toEqual({ time: 50000, price: 970 });
      expect(d.points[1]).toEqual({ time: 80000, price: 940 });
      expect(d.sourceTimeframe).toBe("1Y_1D");
      expect(d.showOnTimeframes).toContain("1Y_1D");
    });
  });

  it("renderiza una linea guardada como <line> SVG en la posicion correcta", () => {
    const inst = makeFakeInstance();
    const drawing = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "free_line",
      points: [
        { time: 50000, price: 970 },
        { time: 80000, price: 940 },
      ],
    });
    const { container } = render(
      <DrawingLayer
        instance={inst}
        drawings={[drawing]}
        editable
        symbol="AAPL"
        sourceTimeframe="1Y_1D"
      />
    );
    const line = container.querySelector("line");
    expect(line).toBeTruthy();
    // timeToCoordinate(msToChartTime(50000)=50)=50 ; priceToCoordinate(970)=30
    expect(line!.getAttribute("x1")).toBe("50");
    expect(line!.getAttribute("y1")).toBe("30");
    expect(line!.getAttribute("x2")).toBe("80");
    expect(line!.getAttribute("y2")).toBe("60");
  });

  it("free_line es FINITO: con rango visible amplio, no se extiende mas alla de A-B", () => {
    // Chart con rango visible enorme (0..1_000_000 ms => 0..1000 s).
    const inst = makeFakeInstance();
    (inst as unknown as { getVisibleTimeRangeMs: () => unknown }).getVisibleTimeRangeMs = () => ({
      startMs: 0,
      endMs: 1_000_000,
    });
    const drawing = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "free_line",
      points: [
        { time: 50000, price: 970 },
        { time: 80000, price: 940 },
      ],
    });
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[drawing]} editable symbol="AAPL" sourceTimeframe="1Y_1D" />
    );
    const line = container.querySelector("line")!;
    // Si proyectara al rango visible, x iria de 0 a 1000. Al ser finito (clip),
    // se queda en los extremos del segmento: 50 y 80.
    expect(line.getAttribute("x1")).toBe("50");
    expect(line.getAttribute("x2")).toBe("80");
  });

  it("NO muestra el panel de debug al activar una herramienta (UI limpia)", () => {
    const inst = makeFakeInstance();
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[]} editable symbol="AAPL" sourceTimeframe="1Y_1D" />
    );
    // El estado interno ("awaiting_first_point", refs, coords) no debe pintarse.
    expect(container.textContent).not.toContain("awaiting_first_point");
    expect(container.textContent).not.toContain("dibujos:");
  });

  it("con cursor activo no captura punteros (no dibuja)", async () => {
    useDrawingStore.setState({ activeTool: "cursor" });
    const inst = makeFakeInstance();
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[]} editable symbol="AAPL" sourceTimeframe="1Y_1D" />
    );
    const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;
    expect(svg.style.pointerEvents).toBe("none");
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 30, pointerId: 1 });
    // No se crea ningun dibujo.
    expect(localStorage.getItem("tap.drawings.v1")).toBeFalsy();
  });
});

describe("DrawingLayer (nuevas herramientas)", () => {
  it("dotted_line se renderiza punteada y finita", () => {
    const inst = makeFakeInstance();
    const drawing = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "dotted_line",
      points: [
        { time: 50000, price: 970 },
        { time: 80000, price: 940 },
      ],
    });
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[drawing]} editable symbol="AAPL" sourceTimeframe="1Y_1D" />
    );
    const line = container.querySelector("line")!;
    expect(line.getAttribute("stroke-dasharray")).toBe("2 4");
    expect(line.getAttribute("x1")).toBe("50");
    expect(line.getAttribute("x2")).toBe("80");
  });

  it("extended_trendline se PROYECTA a todo el rango visible (incluido futuro)", () => {
    const inst = makeFakeInstance();
    (inst as unknown as { getVisibleTimeRangeMs: () => unknown }).getVisibleTimeRangeMs = () => ({
      startMs: 0,
      endMs: 1_000_000,
    });
    const drawing = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "extended_trendline",
      points: [
        { time: 50000, price: 970 },
        { time: 80000, price: 940 },
      ],
    });
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[drawing]} editable symbol="AAPL" sourceTimeframe="1Y_1D" />
    );
    const line = container.querySelector("line")!;
    // Proyectada: cubre el rango visible completo (0s..1000s).
    expect(line.getAttribute("x1")).toBe("0");
    expect(line.getAttribute("x2")).toBe("1000");
  });

  it("ellipse se renderiza con fillOpacity semitransparente", () => {
    const inst = makeFakeInstance();
    const drawing = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "ellipse",
      points: [
        { time: 40000, price: 980 },
        { time: 80000, price: 940 },
      ],
    });
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[drawing]} editable symbol="AAPL" sourceTimeframe="1Y_1D" />
    );
    const ell = container.querySelector("ellipse")!;
    expect(ell).toBeTruthy();
    expect(Number(ell.getAttribute("fill-opacity"))).toBeCloseTo(0.1, 5);
    // Centro del bounding box: x 40..80 -> cx=60; y 20..60 -> cy=40.
    expect(ell.getAttribute("cx")).toBe("60");
    expect(ell.getAttribute("cy")).toBe("40");
  });
});

describe("DrawingLayer (goma / eraser)", () => {
  function makeLine(id: "a" | "b") {
    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "free_line",
      points: [
        { time: 50000, price: 970 },
        { time: 80000, price: 940 },
      ],
    });
    return { ...d, id };
  }

  it("borra SOLO el dibujo superior bajo el click; el resto permanece", async () => {
    useDrawingStore.setState({ activeTool: "eraser" });
    const inst = makeFakeInstance();
    const d1 = makeLine("a");
    const d2 = makeLine("b"); // mismo trazo: solapados; el ultimo es el superior
    // Persistir ambos para verificar que el borrado tambien persiste.
    await useDrawingStore.getState().addDrawing(d1);
    await useDrawingStore.getState().addDrawing(d2);

    const { container } = render(
      <DrawingLayer instance={inst} drawings={[d1, d2]} editable symbol="AAPL" sourceTimeframe="1Y_1D" />
    );
    const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;
    expect(svg.style.pointerEvents).toBe("auto");

    // Click sobre la linea (punto medio del segmento 50,30 -> 80,60).
    fireEvent.pointerDown(svg, { clientX: 65, clientY: 45, pointerId: 1 });

    await waitFor(() => {
      const data = JSON.parse(localStorage.getItem("tap.drawings.v1")!);
      const ids = data.AAPL.map((d: { id: string }) => d.id);
      expect(ids).toEqual(["a"]); // borro el superior ("b"), quedo "a"
    });
  });

  it("click lejos de cualquier dibujo no borra nada", async () => {
    useDrawingStore.setState({ activeTool: "eraser" });
    const inst = makeFakeInstance();
    const d1 = makeLine("a");
    await useDrawingStore.getState().addDrawing(d1);
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[d1]} editable symbol="AAPL" sourceTimeframe="1Y_1D" />
    );
    const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;
    fireEvent.pointerDown(svg, { clientX: 500, clientY: 500, pointerId: 1 });
    const data = JSON.parse(localStorage.getItem("tap.drawings.v1")!);
    expect(data.AAPL).toHaveLength(1);
  });

  it("ARRASTRAR borra al pasar sobre la linea (sin click directo) y sin repetir", async () => {
    useDrawingStore.setState({ activeTool: "eraser" });
    const removeSpy = vi.fn(useDrawingStore.getState().removeDrawing);
    useDrawingStore.setState({ removeDrawing: removeSpy });

    const inst = makeFakeInstance();
    const d1 = makeLine("a"); // segmento pixel (50,30)-(80,60)
    await useDrawingStore.getState().addDrawing(d1);
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[d1]} editable symbol="AAPL" sourceTimeframe="1Y_1D" />
    );
    const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;

    // Presiona LEJOS de la linea, arrastra cruzandola dos veces.
    fireEvent.pointerDown(svg, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 65, clientY: 45, pointerId: 1 }); // toca
    fireEvent.pointerMove(svg, { clientX: 66, clientY: 46, pointerId: 1 }); // re-toca
    fireEvent.pointerUp(svg, { pointerId: 1 });

    await waitFor(() => {
      const data = JSON.parse(localStorage.getItem("tap.drawings.v1")!);
      expect(data.AAPL).toHaveLength(0);
    });
    // Un solo borrado por trazo aunque se cruce varias veces.
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it("sin presionar (solo mover) la goma NO borra", async () => {
    useDrawingStore.setState({ activeTool: "eraser" });
    const inst = makeFakeInstance();
    const d1 = makeLine("a");
    await useDrawingStore.getState().addDrawing(d1);
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[d1]} editable symbol="AAPL" sourceTimeframe="1Y_1D" />
    );
    const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;
    fireEvent.pointerMove(svg, { clientX: 65, clientY: 45, pointerId: 1 });
    const data = JSON.parse(localStorage.getItem("tap.drawings.v1")!);
    expect(data.AAPL).toHaveLength(1);
  });
});
