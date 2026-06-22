// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, waitFor, cleanup, screen } from "@testing-library/react";
import { DrawingLayer } from "./DrawingLayer";
import { DrawingToolbar } from "./DrawingToolbar";
import { createDrawing } from "./createDrawing";
import { useDrawingStore } from "@/stores/drawingStore";
import { useDrawingStyleStore } from "./drawingStyleStore";
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

describe("DrawingLayer (cajas de posición Long/Short)", () => {
  it("un click con LONG_POSITION crea y persiste una caja (3 puntos, target>entry>stop)", async () => {
    useDrawingStore.setState({ activeTool: "LONG_POSITION", selectedDrawingId: null });
    const inst = makeFakeInstance();
    const { container } = render(
      <DrawingLayer
        instance={inst}
        drawings={[]}
        editable
        symbol="AAPL"
        c030Id={7}
        sourceTimeframe="1Y_1D"
        futureInfo={{ lastBarTimeMs: 1_000_000, lastBarIndex: 100, stepMs: 86_400_000 }}
      />
    );
    const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;
    // Con la herramienta de posición activa el overlay DEBE capturar punteros.
    expect(svg.style.pointerEvents).toBe("auto");

    // Un solo click -> caja con defaults.
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 30, pointerId: 1 });

    await waitFor(() => {
      const raw = localStorage.getItem("tap.drawings.v1");
      expect(raw).toBeTruthy();
      const data = JSON.parse(raw!);
      expect(data.AAPL).toHaveLength(1);
      const d = data.AAPL[0];
      expect(d.type).toBe("LONG_POSITION");
      expect(d.points).toHaveLength(3);
      expect(d.points[0].price).toBe(970); // entry = 1000 - 30
      expect(d.points[1].price).toBeGreaterThan(970); // target arriba
      expect(d.points[2].price).toBeLessThan(970); // stop abajo
      expect(d.c030Id).toBe(7);
      expect(d.sourceTimeframe).toBe("1Y_1D");
      expect(d.showOnAllTimeframes).toBe(false);
    });
  });

  it("RENDERIZA la caja aunque el objetivo/stop estén en el FUTURO no proyectable", () => {
    // Chart realista: timeToCoordinate devuelve null para tiempos futuros (más
    // allá del whitespace), tal como Lightweight Charts en la app real. Antes del
    // fix esto hacía que la caja NO se dibujara (positionBoxLocal -> null).
    const chart = {
      timeScale: () => ({
        // Real solo hasta t=100s (=100000ms); más allá -> null (futuro).
        timeToCoordinate: (t: number) => (t <= 100 ? t : null),
        coordinateToTime: (x: number) => x,
        coordinateToLogical: () => null,
      }),
    };
    const series = {
      coordinateToPrice: (y: number) => 1000 - y,
      priceToCoordinate: (p: number) => 1000 - p, // continuo: SIEMPRE válido
    };
    const inst = {
      ...makeFakeInstance(),
      getChartApi: () => chart,
      getMainSeries: () => series,
      getVisibleTimeRangeMs: () => null,
    } as unknown as ChartInstance;

    const box = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "LONG_POSITION",
      points: [
        { time: 100000, price: 100 }, // entry (bar real) -> x=100
        { time: 700000, price: 105 }, // target en futuro -> timeToCoordinate null
        { time: 700000, price: 97 }, // stop en futuro
      ],
      position: { toolType: "LONG_POSITION", quantity: 1 },
    });

    const { container } = render(
      <DrawingLayer
        instance={inst}
        drawings={[box]}
        editable
        symbol="AAPL"
        sourceTimeframe="1Y_1D"
        candles={[{ time: 50000 }, { time: 100000 }]}
        futureInfo={{ lastBarTimeMs: 100000, lastBarIndex: 1, stepMs: 50000 }}
      />
    );
    // La zona de recompensa (verde) debe existir: la caja SE RENDERIZA.
    const greenRect = container.querySelector('rect[fill="#22c55e"]');
    expect(greenRect).toBeTruthy();
    // Borde izquierdo = x de la entrada (100); ancho por defecto al no proyectar.
    expect(Number(greenRect!.getAttribute("x"))).toBe(100);
    expect(Number(greenRect!.getAttribute("width"))).toBeGreaterThan(0);
  });

  it("un click con SHORT_POSITION crea una caja (target<entry<stop)", async () => {
    useDrawingStore.setState({ activeTool: "SHORT_POSITION", selectedDrawingId: null });
    const inst = makeFakeInstance();
    const { container } = render(
      <DrawingLayer
        instance={inst}
        drawings={[]}
        editable
        symbol="AAPL"
        c030Id={7}
        sourceTimeframe="1Y_1D"
        futureInfo={{ lastBarTimeMs: 1_000_000, lastBarIndex: 100, stepMs: 86_400_000 }}
      />
    );
    const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 30, pointerId: 1 });

    await waitFor(() => {
      const data = JSON.parse(localStorage.getItem("tap.drawings.v1")!);
      expect(data.AAPL).toHaveLength(1);
      const d = data.AAPL[0];
      expect(d.type).toBe("SHORT_POSITION");
      expect(d.points[1].price).toBeLessThan(970); // target abajo
      expect(d.points[2].price).toBeGreaterThan(970); // stop arriba
    });
  });

  it("CABLEADO REAL: toolbar (mismo store) -> click chart -> caja creada y RENDERIZADA", async () => {
    // Renderiza la toolbar REAL y la DrawingLayer juntas, compartiendo el store
    // (sin estado de herramienta separado). Reproduce el flujo del usuario:
    // 1) click en el botón "Posición Long"  2) click en la gráfica.
    useDrawingStore.setState({
      drawingsBySymbol: {}, activeTool: "cursor", selectedDrawingId: null,
    });
    const inst = makeFakeInstance();
    function Harness() {
      const drawings = useDrawingStore((s) => s.drawingsBySymbol.AAPL ?? []);
      return (
        <>
          <DrawingToolbar />
          <DrawingLayer
            instance={inst}
            drawings={drawings}
            editable
            symbol="AAPL"
            c030Id={7}
            sourceTimeframe="1Y_1D"
            candles={[{ time: 50000 }, { time: 100000 }]}
            futureInfo={{ lastBarTimeMs: 100000, lastBarIndex: 1, stepMs: 50000 }}
          />
        </>
      );
    }
    const { container } = render(<Harness />);

    // 1) Click en el botón de la toolbar -> el MISMO store recibe la herramienta.
    fireEvent.click(screen.getByTitle(/Plan de posición Long/));
    expect(useDrawingStore.getState().activeTool).toBe("LONG_POSITION");

    // El overlay debe volverse interactivo al activarse la herramienta.
    const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;
    expect(svg.style.pointerEvents).toBe("auto");

    // 2) Click en la gráfica (un punto sobre una vela real: x=100 -> t=100000ms).
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 30, pointerId: 1 });

    // La caja se persiste Y aparece renderizada en el DOM (zona verde).
    await waitFor(() => {
      const data = JSON.parse(localStorage.getItem("tap.drawings.v1")!);
      expect(data.AAPL).toHaveLength(1);
      expect(data.AAPL[0].type).toBe("LONG_POSITION");
    });
    await waitFor(() => {
      expect(container.querySelector('rect[fill="#22c55e"]')).toBeTruthy();
    });
  });

  it("si el guardado FALLA: UN solo toast de error y no falla en silencio", async () => {
    const { useToastStore } = await import("@/components/ui/toastStore");
    useToastStore.setState({ toasts: [] });
    const realAdd = useDrawingStore.getState().addDrawing;
    // Simula el rechazo del backend (p. ej. 422 tipo no permitido).
    useDrawingStore.setState({
      activeTool: "LONG_POSITION",
      selectedDrawingId: null,
      addDrawing: vi.fn().mockRejectedValue(new Error("(422) Backend rejected drawing type")),
    });
    try {
      const inst = makeFakeInstance();
      const { container } = render(
        <DrawingLayer
          instance={inst}
          drawings={[]}
          editable
          symbol="AAPL"
          c030Id={7}
          sourceTimeframe="1Y_1D"
          candles={[{ time: 50000 }, { time: 100000 }]}
          futureInfo={{ lastBarTimeMs: 100000, lastBarIndex: 1, stepMs: 50000 }}
        />
      );
      const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;
      fireEvent.pointerDown(svg, { clientX: 50, clientY: 30, pointerId: 1 });
      await waitFor(() => {
        const errs = useToastStore.getState().toasts.filter((t) => t.type === "error");
        // Exactamente UN toast (un click fallido = un toast, sin spam).
        expect(errs).toHaveLength(1);
      });
    } finally {
      useDrawingStore.setState({ addDrawing: realAdd });
    }
  });

  // Caja LONG con el fake: entry@(x=100,price=100->y=900), target@(x=200,
  // price=110->y=890), stop@(x=200,price=95->y=905).
  async function setupSelectedLongBox() {
    const box = createDrawing({
      symbol: "AAPL", c030Id: 7, sourceTimeframe: "1Y_1D", type: "LONG_POSITION",
      points: [
        { time: 100000, price: 100 },
        { time: 200000, price: 110 },
        { time: 200000, price: 95 },
      ],
      position: { toolType: "LONG_POSITION", quantity: 1 },
    });
    await useDrawingStore.getState().addDrawing(box);
    useDrawingStore.setState({ activeTool: "cursor", selectedDrawingId: box.id });
    return box;
  }

  it("INTEGRACIÓN: arrastrar la manija TARGET cambia SOLO el objetivo", async () => {
    const box = await setupSelectedLongBox();
    const inst = makeFakeInstance();
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[box]} editable symbol="AAPL"
        c030Id={7} sourceTimeframe="1Y_1D" />
    );
    const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;
    // Agarra la manija TARGET en (200, 890) y la sube a y=880 (precio 120).
    fireEvent.pointerDown(svg, { clientX: 200, clientY: 890, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 200, clientY: 880, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    await waitFor(() => {
      const data = JSON.parse(localStorage.getItem("tap.drawings.v1")!);
      const saved = data.AAPL.find((d: { id: string }) => d.id === box.id);
      expect(saved.points[1].price).toBe(120); // target actualizado
      expect(saved.points[0].price).toBe(100); // entry intacto
      expect(saved.points[2].price).toBe(95); // stop intacto
      expect(saved.points[1].time).toBe(200000); // tiempo preservado
    });
  });

  it("INTEGRACIÓN: arrastrar la manija ENTRY mueve las tres líneas (distancias intactas)", async () => {
    const box = await setupSelectedLongBox();
    const inst = makeFakeInstance();
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[box]} editable symbol="AAPL"
        c030Id={7} sourceTimeframe="1Y_1D" />
    );
    const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;
    // Agarra la manija ENTRY en (100, 900) y la sube a y=880 (precio 120, delta +20).
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 900, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 880, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    await waitFor(() => {
      const data = JSON.parse(localStorage.getItem("tap.drawings.v1")!);
      const saved = data.AAPL.find((d: { id: string }) => d.id === box.id);
      expect(saved.points[0].price).toBe(120); // entry
      expect(saved.points[1].price).toBe(130); // target = 110 + 20
      expect(saved.points[2].price).toBe(115); // stop = 95 + 20
      expect(saved.points[0].time).toBe(100000); // tiempos preservados
      expect(saved.points[1].time).toBe(200000);
    });
  });

  // Caja ALTA (gaps de precio grandes) para que la manija de borde derecho (en
  // la línea de entrada) NO solape con las manijas de precio target/stop.
  async function setupTallSelectedLongBox() {
    const box = createDrawing({
      symbol: "AAPL", c030Id: 7, sourceTimeframe: "1Y_1D", type: "LONG_POSITION",
      points: [
        { time: 100000, price: 100 }, // entry -> x=100, y=900
        { time: 200000, price: 150 }, // target -> x=200, y=850
        { time: 200000, price: 50 }, // stop   -> x=200, y=950
      ],
      position: { toolType: "LONG_POSITION", quantity: 1 },
    });
    await useDrawingStore.getState().addDrawing(box);
    useDrawingStore.setState({ activeTool: "cursor", selectedDrawingId: box.id });
    return box;
  }

  it("renderiza la manija de BORDE DERECHO con cursor ew-resize al seleccionar", async () => {
    const box = await setupTallSelectedLongBox();
    const inst = makeFakeInstance();
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[box]} editable symbol="AAPL"
        c030Id={7} sourceTimeframe="1Y_1D" />
    );
    const handle = container.querySelector(
      '[data-testid="position-right-edge-handle"]'
    ) as SVGRectElement;
    expect(handle).toBeTruthy();
    expect(handle.style.cursor).toBe("ew-resize");
  });

  it("INTEGRACIÓN: arrastrar el BORDE DERECHO cambia endTime, no los precios", async () => {
    const box = await setupTallSelectedLongBox();
    const inst = makeFakeInstance();
    const { container } = render(
      <DrawingLayer instance={inst} drawings={[box]} editable symbol="AAPL"
        c030Id={7} sourceTimeframe="1Y_1D" />
    );
    const svg = container.querySelector("svg.drawing-overlay") as SVGSVGElement;
    // Manija de borde derecho en (x1=200, entry.y=900). Arrastra a x=300 (t=300000).
    fireEvent.pointerDown(svg, { clientX: 200, clientY: 900, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 900, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    await waitFor(() => {
      const data = JSON.parse(localStorage.getItem("tap.drawings.v1")!);
      const saved = data.AAPL.find((d: { id: string }) => d.id === box.id);
      expect(saved.points[1].time).toBe(300000); // target endTime extendido
      expect(saved.points[2].time).toBe(300000); // stop endTime extendido
      expect(saved.points[0].time).toBe(100000); // entryTime intacto
      expect(saved.points[0].price).toBe(100); // precios intactos
      expect(saved.points[1].price).toBe(150);
      expect(saved.points[2].price).toBe(50);
    });
  });
});

describe("DrawingLayer (estilo de dibujo POR PANEL, no por timeframe)", () => {
  it("un dibujo nuevo en un panel usa el color del PANEL (fijo, no del timeframe)", async () => {
    // Color del panel (slot chart_1 del workspace 7) = naranja.
    useDrawingStyleStore.getState().setPanelStyle(7, "chart_1", { color: "#f97316" });
    useDrawingStore.setState({ activeTool: "free_line", selectedDrawingId: null });
    const inst = makeFakeInstance();
    const { container } = render(
      <DrawingLayer
        instance={inst}
        drawings={[]}
        editable
        symbol="AAPL"
        c030Id={7}
        slotId="chart_1"
        sourceTimeframe="1Y_1D"
      />
    );
    const svg = container.querySelector("svg.drawing-overlay")!;
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerDown(svg, { clientX: 80, clientY: 60, pointerId: 1 });

    await waitFor(() => {
      const data = JSON.parse(localStorage.getItem("tap.drawings.v1")!);
      expect(data.AAPL).toHaveLength(1);
      const d = data.AAPL[0];
      // Color FIJO del panel, marcado como NO-timeframe-default: no cambiará si
      // el panel cambia de range/interval (su sourceTimeframe).
      expect(d.style.color).toBe("#f97316");
      expect(d.style.usesTimeframeDefaultColor).toBe(false);
      expect(d.sourceTimeframe).toBe("1Y_1D");
    });
  });

  it("el PREVIEW usa el color del panel (no un color temporal distinto)", () => {
    useDrawingStyleStore.getState().setPanelStyle(7, "chart_1", { color: "#f97316" });
    useDrawingStore.setState({ activeTool: "free_line", selectedDrawingId: null });
    const inst = makeFakeInstance();
    const { container } = render(
      <DrawingLayer
        instance={inst}
        drawings={[]}
        editable
        symbol="AAPL"
        c030Id={7}
        slotId="chart_1"
        sourceTimeframe="1Y_1D"
      />
    );
    const svg = container.querySelector("svg.drawing-overlay")!;
    // Primer click + movimiento: aparece el PREVIEW (aún no se persiste).
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 80, clientY: 60, pointerId: 1 });
    // La línea de preview debe tener el color del panel (naranja), igual que el final.
    const previewLine = container.querySelector("line");
    expect(previewLine).toBeTruthy();
    expect(previewLine!.getAttribute("stroke")).toBe("#f97316");
    // Y todavía no se guardó nada (sigue siendo preview).
    expect(localStorage.getItem("tap.drawings.v1")).toBeFalsy();
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
