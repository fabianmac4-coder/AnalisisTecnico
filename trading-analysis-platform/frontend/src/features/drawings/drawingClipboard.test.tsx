// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

vi.mock("@/components/ui/toastStore", () => ({ showToast: vi.fn() }));

import {
  duplicateSelectedDrawing,
  useDrawingClipboardKeys,
  useDrawingClipboardStore,
} from "./drawingClipboard";
import { useDrawingStore } from "@/stores/drawingStore";
import { showToast } from "@/components/ui/toastStore";
import type { Drawing } from "./drawingTypes";

function drawing(id: string): Drawing {
  return {
    id,
    symbol: "AAPL",
    c030Id: 7,
    sourceTimeframe: "1Y_1D",
    type: "free_line",
    points: [
      { time: 1_000_000, price: 100 },
      { time: 2_000_000, price: 110 },
    ],
    style: { color: "#ff0000", width: 2, lineStyle: "solid", opacity: 1 },
    visible: true,
    locked: false,
    showOnAllTimeframes: true,
    showOnTimeframes: ["1Y_1D"],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    version: 3,
  };
}

let addDrawing: ReturnType<typeof vi.fn>;
let selectDrawing: ReturnType<typeof vi.fn>;

function setStore(selectedId: string | null, list: Drawing[]) {
  addDrawing = vi.fn(async (d: Drawing) => d);
  selectDrawing = vi.fn();
  useDrawingStore.setState({
    drawingsBySymbol: { AAPL: list },
    selectedDrawingId: selectedId,
    addDrawing,
    selectDrawing,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useDrawingClipboardStore.setState({ clipboard: null });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Host() {
  useDrawingClipboardKeys("AAPL");
  return <input data-testid="typing" />;
}

describe("duplicateSelectedDrawing", () => {
  it("duplica el dibujo seleccionado (nuevo id, mismo tipo) y lo selecciona", async () => {
    setStore("100", [drawing("100")]);
    await duplicateSelectedDrawing("AAPL");
    expect(addDrawing).toHaveBeenCalledTimes(1);
    const dup = addDrawing.mock.calls[0][0] as Drawing;
    expect(dup.id).not.toBe("100");
    expect(dup.type).toBe("free_line");
    expect(dup.c030Id).toBe(7);
    expect(selectDrawing).toHaveBeenCalledWith(dup.id);
    expect(showToast).toHaveBeenCalledWith("Dibujo duplicado", "success");
  });

  it("sin selección muestra aviso y no crea nada", async () => {
    setStore(null, [drawing("100")]);
    await duplicateSelectedDrawing("AAPL");
    expect(addDrawing).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      "Selecciona un dibujo para duplicarlo.",
      "error"
    );
  });
});

describe("useDrawingClipboardKeys (Ctrl+C / Ctrl+V)", () => {
  it("Ctrl+C copia el seleccionado y Ctrl+V pega un duplicado", async () => {
    setStore("100", [drawing("100")]);
    render(<Host />);

    fireEvent.keyDown(document.body, { key: "c", ctrlKey: true });
    expect(useDrawingClipboardStore.getState().clipboard?.id).toBe("100");

    fireEvent.keyDown(document.body, { key: "v", ctrlKey: true });
    await Promise.resolve();
    expect(addDrawing).toHaveBeenCalledTimes(1);
    const dup = addDrawing.mock.calls[0][0] as Drawing;
    expect(dup.id).not.toBe("100");
  });

  it("no copia cuando el foco está en un input (no secuestra copiar texto)", () => {
    setStore("100", [drawing("100")]);
    const { getByTestId } = render(<Host />);
    fireEvent.keyDown(getByTestId("typing"), { key: "c", ctrlKey: true });
    expect(useDrawingClipboardStore.getState().clipboard).toBeNull();
  });

  it("Ctrl+C sin selección no copia nada", () => {
    setStore(null, [drawing("100")]);
    render(<Host />);
    fireEvent.keyDown(document.body, { key: "c", ctrlKey: true });
    expect(useDrawingClipboardStore.getState().clipboard).toBeNull();
  });
});
