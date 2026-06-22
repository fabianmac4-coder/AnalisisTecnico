// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { DrawingFilterToolbar } from "./DrawingFilterToolbar";
import { useDrawingStyleStore } from "./drawingStyleStore";
import { useDrawingOriginVisibilityStore, originVisKey } from "./drawingOriginVisibilityStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { useChartStore } from "@/stores/chartStore";
import { DEFAULT_CHART_SLOTS } from "@/features/charts/chartWorkspaceTypes";

beforeEach(() => {
  localStorage.clear();
  useDrawingStyleStore.setState({ panelStyles: {} });
  useDrawingOriginVisibilityStore.setState({ hidden: {} });
  useChartStore.setState({ activeSymbol: "AAPL" });
});
afterEach(() => cleanup());

describe("DrawingFilterToolbar — gestión por GRÁFICA DE ORIGEN", () => {
  it("muestra 'Dibujos de Gráfica 1…6' y NO etiquetas de temporalidad", () => {
    render(<DrawingFilterToolbar c030Id={7} slots={DEFAULT_CHART_SLOTS} />);
    for (let n = 1; n <= 6; n++) {
      expect(screen.getByText(`Dibujos de Gráfica ${n}`)).toBeTruthy();
    }
    for (const old of ["4Y W", "1Y D", "6M D", "3M D", "1M H", "1W 30M"]) {
      expect(screen.queryByText(old)).toBeNull();
    }
  });

  it("cada gráfica tiene mostrar/ocultar y borrar; NO hay control de grosor", () => {
    const { container } = render(<DrawingFilterToolbar c030Id={7} slots={DEFAULT_CHART_SLOTS} />);
    for (const sid of DEFAULT_CHART_SLOTS.map((s) => s.slotId)) {
      expect(screen.getByTestId(`gfx-toggle-${sid}`)).toBeTruthy();
      expect(screen.getByTestId(`gfx-delete-${sid}`)).toBeTruthy();
    }
    // El control de grosor fue removido.
    expect(container.querySelector('[data-testid^="gfx-width-"]')).toBeNull();
  });

  it("el 👁 oculta/muestra la gráfica de origen (persistido por workspace+símbolo)", () => {
    render(<DrawingFilterToolbar c030Id={7} slots={DEFAULT_CHART_SLOTS} />);
    fireEvent.click(screen.getByTestId("gfx-toggle-chart_1"));
    expect(
      useDrawingOriginVisibilityStore.getState().hidden[originVisKey(7, "AAPL", "chart_1")]
    ).toBe(true);
    // Otra gráfica NO se ve afectada.
    expect(
      useDrawingOriginVisibilityStore.getState().hidden[originVisKey(7, "AAPL", "chart_2")]
    ).toBeUndefined();
    // Volver a clic la muestra de nuevo.
    fireEvent.click(screen.getByTestId("gfx-toggle-chart_1"));
    expect(
      useDrawingOriginVisibilityStore.getState().hidden[originVisKey(7, "AAPL", "chart_1")]
    ).toBeUndefined();
  });

  it("el ✕ borra por gráfica de origen (con confirmación)", () => {
    const spy = vi.fn().mockResolvedValue(undefined);
    const real = useDrawingStore.getState().deleteByOriginSlot;
    useDrawingStore.setState({ deleteByOriginSlot: spy });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<DrawingFilterToolbar c030Id={7} slots={DEFAULT_CHART_SLOTS} />);
      fireEvent.click(screen.getByTestId("gfx-delete-chart_3"));
      expect(spy).toHaveBeenCalledWith("AAPL", "chart_3");
    } finally {
      useDrawingStore.setState({ deleteByOriginSlot: real });
    }
  });

  it("cada gráfica arranca con su color por defecto propio (6 distintos)", () => {
    const { container } = render(<DrawingFilterToolbar c030Id={7} slots={DEFAULT_CHART_SLOTS} />);
    const inputs = Array.from(
      container.querySelectorAll('input[type="color"]')
    ) as HTMLInputElement[];
    expect(inputs).toHaveLength(6);
    expect(new Set(inputs.map((i) => i.value)).size).toBe(6);
  });

  it("cambiar el color de Gráfica 4 solo afecta a chart_4 (workspace 7)", () => {
    render(<DrawingFilterToolbar c030Id={7} slots={DEFAULT_CHART_SLOTS} />);
    const colorInput = screen.getByTestId("gfx-color-chart_4").querySelector("input")!;
    fireEvent.change(colorInput, { target: { value: "#123456" } });
    const get = useDrawingStyleStore.getState().getPanelStyle;
    expect(get(7, "chart_4").color).toBe("#123456");
    expect(get(7, "chart_1").color).toBe("#f97316");
    expect(get(7, "chart_6").color).toBe("#eab308");
  });

  it("no renderiza nada si no hay slots", () => {
    const { container } = render(<DrawingFilterToolbar c030Id={7} slots={[]} />);
    expect(container.textContent).toBe("");
  });
});
