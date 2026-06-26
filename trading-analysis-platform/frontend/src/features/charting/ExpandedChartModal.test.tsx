// @vitest-environment jsdom
// La gráfica maximizada debe exponer rango/intervalo, Actualizar y Modo Replay.
// Se renderiza SIN datos del slot para que ChartCanvas (LWC) no se monte en jsdom.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { ExpandedChartModal } from "./ExpandedChartModal";
import { useChartStore } from "@/stores/chartStore";
import { useChartWorkspaceStore } from "@/features/charts/chartWorkspaceStore";
import { useReplayStore } from "@/features/replay/replayStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { useDrawingStyleStore } from "@/features/drawings/drawingStyleStore";
import type { Drawing } from "@/features/drawings/drawingTypes";
import type { ChartSlotConfig, ChartWorkspace } from "@/features/charts/chartWorkspaceTypes";

const slot: ChartSlotConfig = { slotId: "chart_3", range: "6M", interval: "1d" };

const SIX: ChartSlotConfig[] = [
  { slotId: "chart_1", range: "5Y", interval: "1wk" },
  { slotId: "chart_2", range: "1Y", interval: "1d" },
  { slotId: "chart_3", range: "6M", interval: "1d" },
  { slotId: "chart_4", range: "3M", interval: "1d" },
  { slotId: "chart_5", range: "1M", interval: "1h" },
  { slotId: "chart_6", range: "1W", interval: "30m" },
];

function workspace(): ChartWorkspace {
  return {
    c030Id: 7,
    name: "Default Analysis",
    symbol: "AAPL",
    c010Id: 1,
    isDefault: true,
    chartSlots: [slot],
    configuration: {},
  };
}

beforeEach(() => {
  // Sin datos del slot => no se monta ChartCanvas.
  useChartStore.setState({
    chartDataBySlot: {},
    quoteBySymbol: {},
    chartTypeBySlot: {},
    loadingBySlot: {},
    reloadSlot: vi.fn().mockResolvedValue(undefined),
  });
  useChartWorkspaceStore.setState({
    workspacesBySymbol: { AAPL: [workspace()] },
    activeWorkspaceBySymbol: { AAPL: 7 },
    updateChartSlot: vi.fn().mockResolvedValue(undefined),
  });
  useReplayStore.setState({
    enabled: false,
    symbol: null,
    cursorTime: null,
    speedMultiplier: 1,
    playing: false,
    selecting: false,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ExpandedChartModal (maximizado)", () => {
  it("muestra rango/intervalo, Actualizar, Cerrar y Modo Replay", () => {
    render(<ExpandedChartModal slot={slot} symbol="AAPL" onClose={() => {}} />);
    expect(screen.getByTestId("slot-config-selector")).toBeTruthy();
    expect(screen.getByTestId("expanded-refresh")).toBeTruthy();
    expect(screen.getByTestId("expanded-close")).toBeTruthy();
    expect(screen.getByTestId("replay-enable")).toBeTruthy();
  });

  it("cambiar el rango persiste en el workspace activo y recarga el slot", () => {
    render(<ExpandedChartModal slot={slot} symbol="AAPL" onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Rango"), { target: { value: "1M" } });
    const updateChartSlot = useChartWorkspaceStore.getState().updateChartSlot as unknown as ReturnType<typeof vi.fn>;
    const reloadSlot = useChartStore.getState().reloadSlot as unknown as ReturnType<typeof vi.fn>;
    expect(updateChartSlot).toHaveBeenCalledWith("AAPL", 7, "chart_3", "1M", "1d");
    expect(reloadSlot).toHaveBeenCalled();
  });

  it("Actualizar no cierra el maximizado (no llama onClose)", () => {
    const onClose = vi.fn();
    render(<ExpandedChartModal slot={slot} symbol="AAPL" onClose={onClose} />);
    fireEvent.click(screen.getByTestId("expanded-refresh"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("los controles de Replay están disponibles maximizado", () => {
    useReplayStore.setState({ enabled: true, symbol: "AAPL", cursorTime: 1000 });
    render(<ExpandedChartModal slot={slot} symbol="AAPL" onClose={() => {}} />);
    expect(screen.getByTestId("replay-controls")).toBeTruthy();
    expect(screen.getByTestId("replay-step-forward")).toBeTruthy();
  });

  it("muestra color de línea, Duplicar e Indicadores (control global)", () => {
    render(<ExpandedChartModal slot={slot} symbol="AAPL" onClose={() => {}} />);
    expect(screen.getByTestId("expanded-drawing-color")).toBeTruthy();
    expect(screen.getByTestId("expanded-duplicate")).toBeTruthy();
    // Control GLOBAL de indicadores (no toggles locales que forzaban RSI/MACD).
    expect(screen.getByText("ƒ Indicadores")).toBeTruthy();
  });

  it("cambiar el color usa el MISMO panelStyle store que el panel normal", () => {
    render(<ExpandedChartModal slot={slot} symbol="AAPL" onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Color de línea"), {
      target: { value: "#00ff00" },
    });
    expect(useDrawingStyleStore.getState().getPanelStyle(7, "chart_3").color).toBe(
      "#00ff00"
    );
  });

  it("Duplicar duplica el dibujo seleccionado", () => {
    const addDrawing = vi.fn(async (d: Drawing) => d);
    useDrawingStore.setState({
      drawingsBySymbol: {
        AAPL: [
          {
            id: "100",
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
          } as Drawing,
        ],
      },
      selectedDrawingId: "100",
      addDrawing,
      selectDrawing: vi.fn(),
    });
    render(<ExpandedChartModal slot={slot} symbol="AAPL" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId("expanded-duplicate"));
    expect(addDrawing).toHaveBeenCalledTimes(1);
    expect((addDrawing.mock.calls[0][0] as Drawing).id).not.toBe("100");
  });

  it("muestra el selector de Gráfica 1..6 y el título 'Gráfica N'", () => {
    render(
      <ExpandedChartModal
        slot={slot}
        symbol="AAPL"
        slots={SIX}
        onSelectSlot={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByTestId("expanded-slot-selector")).toBeTruthy();
    for (const s of SIX) {
      expect(screen.getByTestId(`expanded-slot-${s.slotId}`)).toBeTruthy();
    }
    // slot = chart_3 => índice 2 => "Gráfica 3".
    expect(screen.getByText(/Gráfica 3 ·/)).toBeTruthy();
  });

  it("cambiar de gráfica llama onSelectSlot y NO cierra el maximizado", () => {
    const onSelectSlot = vi.fn();
    const onClose = vi.fn();
    render(
      <ExpandedChartModal
        slot={slot}
        symbol="AAPL"
        slots={SIX}
        onSelectSlot={onSelectSlot}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByTestId("expanded-slot-chart_2"));
    expect(onSelectSlot).toHaveBeenCalledWith("chart_2");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("el rango/intervalo reflejan la gráfica maximizada actual", () => {
    // Maximizado en Gráfica 2 (1Y/1d): el selector de rango muestra 1Y.
    render(
      <ExpandedChartModal
        slot={SIX[1]}
        symbol="AAPL"
        slots={SIX}
        onSelectSlot={() => {}}
        onClose={() => {}}
      />
    );
    expect((screen.getByLabelText("Rango") as HTMLSelectElement).value).toBe("1Y");
    expect(screen.getByText(/Gráfica 2 ·/)).toBeTruthy();
  });
});
