// @vitest-environment jsdom
// Los dibujos están AISLADOS por workspace (C030Id): un dibujo de un workspace
// no aparece, no se mueve ni se borra desde otro workspace.
import { describe, it, expect, beforeEach } from "vitest";
import { useDrawingStore } from "@/stores/drawingStore";
import type { Drawing } from "./drawingTypes";

function drawing(id: string, c030Id: number, price = 1): Drawing {
  return {
    id,
    symbol: "AAPL",
    c030Id,
    sourceTimeframe: "1Y_1D",
    type: "free_line",
    points: [
      { time: 1, price },
      { time: 2, price: price + 1 },
    ],
    style: { color: "#fff", width: 2, lineStyle: "solid", opacity: 1 },
    visible: true,
    locked: false,
    showOnAllTimeframes: true,
    createdAt: "",
    updatedAt: "",
    version: 3,
  };
}

function current(): Drawing[] {
  return useDrawingStore.getState().drawingsBySymbol.AAPL ?? [];
}

beforeEach(() => {
  localStorage.clear();
  useDrawingStore.setState({
    drawingsBySymbol: {},
    loadedWorkspaceBySymbol: {},
    selectedDrawingId: null,
    activeTool: "cursor",
  });
});

describe("aislamiento de dibujos por workspace", () => {
  it("un dibujo de workspace 1 no aparece en workspace 2", async () => {
    const s = useDrawingStore.getState();
    await s.loadDrawings("AAPL", 1);
    await s.addDrawing(drawing("a", 1));
    await s.loadDrawings("AAPL", 2);
    await s.addDrawing(drawing("b", 2));

    await s.loadDrawings("AAPL", 1);
    expect(current().map((d) => d.id)).toEqual(["a"]);
    await s.loadDrawings("AAPL", 2);
    expect(current().map((d) => d.id)).toEqual(["b"]);
  });

  it("mover un dibujo en workspace 1 no afecta a workspace 2", async () => {
    const s = useDrawingStore.getState();
    await s.loadDrawings("AAPL", 1);
    await s.addDrawing(drawing("a", 1, 10));
    await s.loadDrawings("AAPL", 2);
    await s.addDrawing(drawing("b", 2, 20));

    // Mueve 'a' (workspace 1).
    await s.loadDrawings("AAPL", 1);
    await s.updateDrawing({ ...drawing("a", 1, 99) });

    await s.loadDrawings("AAPL", 2);
    const ws2 = current();
    expect(ws2.map((d) => d.id)).toEqual(["b"]);
    expect(ws2[0].points[0].price).toBe(20); // intacto
  });

  it("borrar un dibujo en workspace 2 no afecta a workspace 1", async () => {
    const s = useDrawingStore.getState();
    await s.loadDrawings("AAPL", 1);
    await s.addDrawing(drawing("a", 1));
    await s.loadDrawings("AAPL", 2);
    await s.addDrawing(drawing("b", 2));

    await s.removeDrawing("b");
    await s.loadDrawings("AAPL", 1);
    expect(current().map((d) => d.id)).toEqual(["a"]);
    await s.loadDrawings("AAPL", 2);
    expect(current()).toEqual([]);
  });

  it("loadDrawings reemplaza (no mezcla) los dibujos al cambiar de workspace", async () => {
    const s = useDrawingStore.getState();
    await s.loadDrawings("AAPL", 1);
    await s.addDrawing(drawing("a", 1));
    await s.addDrawing(drawing("c", 1));
    await s.loadDrawings("AAPL", 2);
    expect(current()).toEqual([]); // workspace 2 vacío, sin los de ws1
    expect(useDrawingStore.getState().loadedWorkspaceBySymbol.AAPL).toBe(2);
  });
});
