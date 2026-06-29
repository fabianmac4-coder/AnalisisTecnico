// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { DrawingLayer } from "./DrawingLayer";
import { createDrawing } from "./createDrawing";
import { useDrawingStore } from "@/stores/drawingStore";
import { useDrawingLabelStore } from "./drawingLabelStore";
import type { ChartInstance } from "@/features/charting/chartEngine/ChartEngineAdapter";
import type { Drawing, DrawingType } from "./drawingTypes";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

// timeToCoordinate(t)=t (segundos), priceToCoordinate(p)=1000-p; getVisibleTimeRangeMs
// = null => las líneas usan el segmento crudo A-B (sin recorte).
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
    getVisibleTimeRangeMs: () => null,
  } as unknown as ChartInstance;
}

function line(type: DrawingType = "free_line"): Drawing {
  return createDrawing({
    symbol: "AAPL",
    sourceTimeframe: "1Y_1D",
    type,
    points: [
      { time: 50000, price: 970 },
      { time: 80000, price: 940 },
    ],
  });
}

function renderLayer(drawings: Drawing[]) {
  return render(
    <DrawingLayer
      instance={makeFakeInstance()}
      drawings={drawings}
      editable
      symbol="AAPL"
      sourceTimeframe="1Y_1D"
    />
  );
}

function labels(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('[data-testid="drawing-price-label"]'));
}

beforeEach(() => {
  useDrawingStore.setState({ drawingsBySymbol: {}, activeTool: "cursor", selectedDrawingId: null });
  useDrawingLabelStore.setState({ showPriceLabels: true });
});
afterEach(() => cleanup());

describe("etiquetas de precio en extremos de línea", () => {
  it("Free Line muestra etiqueta en A y en B con los precios de PuntosJSON", () => {
    const { container } = renderLayer([line("free_line")]);
    const els = labels(container);
    expect(els).toHaveLength(2);
    const text = els.map((e) => e.textContent).join(" ");
    expect(text).toContain("970");
    expect(text).toContain("940");
  });

  it("Línea punteada muestra etiquetas de precio", () => {
    const { container } = renderLayer([line("dotted_line")]);
    expect(labels(container)).toHaveLength(2);
  });

  it("Trendline extendida muestra etiquetas de precio", () => {
    const { container } = renderLayer([line("extended_trendline")]);
    expect(labels(container)).toHaveLength(2);
  });

  it("con la preferencia global desactivada NO se muestran etiquetas", () => {
    useDrawingLabelStore.setState({ showPriceLabels: false });
    const { container } = renderLayer([line("free_line")]);
    expect(labels(container)).toHaveLength(0);
  });

  it("override por dibujo (showEndpointPriceLabels=false) oculta las etiquetas", () => {
    const d = line("free_line");
    d.style.showEndpointPriceLabels = false;
    const { container } = renderLayer([d]);
    expect(labels(container)).toHaveLength(0);
  });

  it("rectángulo no muestra etiquetas de precio (fuera de alcance)", () => {
    const { container } = renderLayer([line("rectangle")]);
    expect(labels(container)).toHaveLength(0);
  });

  it("precio no finito en un extremo no crashea (omite esa etiqueta)", () => {
    const d = line("free_line");
    d.points[0] = { time: 50000, price: NaN };
    expect(() => renderLayer([d])).not.toThrow();
  });
});

describe("línea horizontal", () => {
  function horizontal(): Drawing {
    return createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "free_line",
      points: [
        { time: 50000, price: 970 },
        { time: 80000, price: 970 }, // mismo precio (horizontal)
      ],
      horizontalLock: true,
    });
  }

  it("crear con DOS clics fuerza el precio de B al de A y marca horizontalLock", async () => {
    useDrawingStore.setState({ activeTool: "horizontal" });
    const { container } = render(
      <DrawingLayer
        instance={makeFakeInstance()}
        drawings={[]}
        editable
        symbol="AAPL"
        sourceTimeframe="1Y_1D"
      />
    );
    const svg = container.querySelector("svg.drawing-overlay")!;
    // A en (50,30) => price 970 ; B en (80,60) => price 940 pero se fuerza a 970.
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerDown(svg, { clientX: 80, clientY: 60, pointerId: 1 });

    await waitFor(() => {
      const data = JSON.parse(localStorage.getItem("tap.drawings.v1")!);
      const d = data.AAPL[0];
      expect(d.type).toBe("free_line");
      expect(d.style.horizontalLock).toBe(true);
      expect(d.points[0].price).toBe(970);
      expect(d.points[1].price).toBe(970); // forzado al de A
      expect(d.points[1].time).toBe(80000); // B aporta el largo (tiempo)
    });
  });

  it("muestra UNA etiqueta de precio (extremo derecho) con el precio del nivel", () => {
    const { container } = renderLayer([horizontal()]);
    const els = labels(container);
    expect(els).toHaveLength(1);
    expect(els[0].textContent).toContain("970");
  });

  it("la etiqueta es OBLIGATORIA aunque la preferencia global esté off", () => {
    useDrawingLabelStore.setState({ showPriceLabels: false });
    const { container } = renderLayer([horizontal()]);
    expect(labels(container)).toHaveLength(1);
  });

  it("dibujada de DERECHA a IZQUIERDA: una etiqueta junto al extremo derecho (mayor tiempo)", () => {
    // A (time 90000 -> x=90) está a la DERECHA de B (time 40000 -> x=40).
    const d = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "free_line",
      points: [
        { time: 90000, price: 970 },
        { time: 40000, price: 970 },
      ],
      horizontalLock: true,
    });
    const { container } = renderLayer([d]);
    const els = labels(container);
    expect(els).toHaveLength(1);
    // La etiqueta se coloca a la derecha del extremo derecho (x≈96), NO del
    // extremo izquierdo (x≈40) -> confirma que se recomputa el extremo derecho.
    const rectX = Number(els[0].querySelector("rect")!.getAttribute("x"));
    expect(rectX).toBeGreaterThan(50);
  });

  it("la línea duplicada conserva horizontalLock y su etiqueta", () => {
    const dup = { ...horizontal(), id: "999", points: [
      { time: 50000, price: 980 },
      { time: 80000, price: 980 },
    ] };
    const { container } = renderLayer([dup]);
    expect(labels(container)).toHaveLength(1);
    expect(labels(container)[0].textContent).toContain("980");
  });
});
