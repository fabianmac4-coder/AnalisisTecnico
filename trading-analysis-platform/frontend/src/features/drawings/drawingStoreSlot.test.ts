// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { useDrawingStore } from "@/stores/drawingStore";
import { createDrawing } from "./createDrawing";

function lineInSlot(slotId: string, tf = "1Y_1D", symbol = "AAPL") {
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

beforeEach(() => {
  localStorage.clear();
  useDrawingStore.setState({ drawingsBySymbol: {}, selectedDrawingId: null });
});

describe("clearForSymbol — borra TODO el análisis (compartido por las 6 gráficas)", () => {
  it("borra dibujos de distintas gráficas/temporalidades a la vez", async () => {
    const s = useDrawingStore.getState();
    await s.addDrawing(lineInSlot("chart_1", "4Y_1W"));
    await s.addDrawing(lineInSlot("chart_2", "1Y_1D"));
    await s.addDrawing(lineInSlot("chart_3", "1W_30M"));
    expect(useDrawingStore.getState().drawingsBySymbol.AAPL).toHaveLength(3);

    await useDrawingStore.getState().clearForSymbol("AAPL");

    expect(useDrawingStore.getState().drawingsBySymbol.AAPL ?? []).toHaveLength(0);
  });

  it("también borra las cajas Long/Short del análisis", async () => {
    const box = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "LONG_POSITION",
      points: [
        { time: 1, price: 100 },
        { time: 2, price: 105 },
        { time: 2, price: 97 },
      ],
      chartSlotId: "chart_1",
      position: { toolType: "LONG_POSITION", quantity: 1 },
    });
    const s = useDrawingStore.getState();
    await s.addDrawing(box);
    await s.addDrawing(lineInSlot("chart_2"));

    await useDrawingStore.getState().clearForSymbol("AAPL");

    expect(useDrawingStore.getState().drawingsBySymbol.AAPL ?? []).toHaveLength(0);
  });

  it("NO toca los dibujos de otra acción (aislamiento por stock)", async () => {
    const s = useDrawingStore.getState();
    await s.addDrawing(lineInSlot("chart_1", "1Y_1D", "AAPL"));
    await s.addDrawing(lineInSlot("chart_1", "1Y_1D", "TSLA"));

    await useDrawingStore.getState().clearForSymbol("AAPL");

    expect(useDrawingStore.getState().drawingsBySymbol.AAPL ?? []).toHaveLength(0);
    expect(useDrawingStore.getState().drawingsBySymbol.TSLA).toHaveLength(1);
  });
});

describe("deleteByOriginSlot — borra por GRÁFICA DE ORIGEN (no por temporalidad)", () => {
  it("borra los creados desde chart_1 (varias temporalidades) y conserva chart_2", async () => {
    const s = useDrawingStore.getState();
    await s.addDrawing(lineInSlot("chart_1", "4Y_1W"));
    await s.addDrawing(lineInSlot("chart_1", "1W_30M"));
    const keep = await s.addDrawing(lineInSlot("chart_2", "1Y_1D"));

    await useDrawingStore.getState().deleteByOriginSlot("AAPL", "chart_1");

    const left = useDrawingStore.getState().drawingsBySymbol.AAPL;
    expect(left).toHaveLength(1);
    expect(left[0].id).toBe(keep.id);
  });

  it("borra también las cajas Long/Short creadas desde esa gráfica", async () => {
    const box = createDrawing({
      symbol: "AAPL",
      sourceTimeframe: "1Y_1D",
      type: "LONG_POSITION",
      points: [
        { time: 1, price: 100 },
        { time: 2, price: 105 },
        { time: 2, price: 97 },
      ],
      chartSlotId: "chart_1",
      position: { toolType: "LONG_POSITION", quantity: 1 },
    });
    const s = useDrawingStore.getState();
    await s.addDrawing(box);
    await s.addDrawing(lineInSlot("chart_2"));

    await useDrawingStore.getState().deleteByOriginSlot("AAPL", "chart_1");

    const left = useDrawingStore.getState().drawingsBySymbol.AAPL;
    expect(left).toHaveLength(1);
    expect(left[0].style.chartSlotId).toBe("chart_2");
  });

  it("usa el mapeo histórico para dibujos viejos sin chartSlotId (4Y_1W → chart_1)", async () => {
    const s = useDrawingStore.getState();
    await s.addDrawing(
      createDrawing({
        symbol: "AAPL", sourceTimeframe: "4Y_1W", type: "free_line",
        points: [{ time: 1, price: 1 }, { time: 2, price: 2 }], color: "#fff",
      })
    );
    await s.addDrawing(lineInSlot("chart_2"));

    await useDrawingStore.getState().deleteByOriginSlot("AAPL", "chart_1");

    const left = useDrawingStore.getState().drawingsBySymbol.AAPL;
    expect(left).toHaveLength(1);
    expect(left[0].style.chartSlotId).toBe("chart_2");
  });
});
