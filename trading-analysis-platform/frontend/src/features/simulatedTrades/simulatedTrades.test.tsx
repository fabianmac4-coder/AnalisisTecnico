// @vitest-environment jsdom
// Tests del panel de entradas simuladas y su modal.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { SimulatedTradesPanel } from "./SimulatedTradesPanel";
import { SimulatedTradeModal } from "./SimulatedTradeModal";
import { useSimulatedTradesStore } from "./simulatedTradesStore";
import { useSymbolStore } from "@/stores/symbolStore";
import type { SimulatedTrade } from "./simulatedTradesTypes";

const TRADE: SimulatedTrade = {
  id: 1,
  c010Id: 10,
  symbol: "AAPL",
  type: "LONG",
  entryPrice: 185.25,
  quantity: 10,
  entryDate: "2026-05-01T14:30:00",
  sourceTimeframe: "1Y_1D",
  name: "Prueba en soporte",
  notes: "Entrada hipotética",
  status: "ABIERTA",
  color: "#22c55e",
  exitPrice: null,
  exitDate: null,
  exitReason: null,
  currentPrice: 195.3,
  gainLossAmount: 10.05,
  gainLossPercent: 5.42,
  totalGainLossAmount: 100.5,
  daysSinceEntry: 35,
  visible: true,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  useSymbolStore.setState({ activeSymbol: "AAPL" });
  useSimulatedTradesStore.setState({
    tradesBySymbol: { AAPL: [TRADE] },
    loading: false,
    error: null,
    modalOpen: false,
  });
});
afterEach(() => cleanup());

describe("SimulatedTradesPanel", () => {
  it("muestra la entrada con su ganancia/perdida en verde", () => {
    render(<SimulatedTradesPanel />);
    expect(screen.getByTestId("sim-trades-panel")).toBeTruthy();
    expect(screen.getByText("LONG @ 185.25")).toBeTruthy();
    expect(screen.getByText("+5.42%")).toBeTruthy();
    expect(screen.getByText(/35 día/)).toBeTruthy();
    expect(screen.getByTestId("sim-entry-button")).toBeTruthy();
  });

  it("el boton Sim Entry abre el modal con el tipo LONG por defecto", () => {
    render(
      <>
        <SimulatedTradesPanel />
        <SimulatedTradeModal />
      </>
    );
    fireEvent.click(screen.getByTestId("sim-entry-button"));
    expect(screen.getByTestId("sim-entry-modal")).toBeTruthy();
    expect(screen.getByText(/paper trading hipotético/i)).toBeTruthy();
  });

  it("guardar una entrada hace POST a /simulated-trades", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ ...TRADE, id: 2, entryPrice: 200 }, 201) as never
    );
    useSimulatedTradesStore.setState({ modalOpen: true });
    render(<SimulatedTradeModal />);

    fireEvent.change(screen.getByTestId("sim-entry-price"), { target: { value: "200" } });
    fireEvent.click(screen.getByTestId("sim-entry-save"));

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "POST"
      );
      expect(post).toBeTruthy();
      expect(String(post![0])).toContain("/simulated-trades");
      const body = JSON.parse((post![1] as RequestInit).body as string);
      expect(body.symbol).toBe("AAPL");
      expect(body.entryPrice).toBe(200);
      expect(body.type).toBe("LONG");
    });
    // La nueva entrada quedo en el store (marcadores la leeran de aqui).
    expect(useSimulatedTradesStore.getState().tradesBySymbol.AAPL).toHaveLength(2);
  });

  it("eliminar (confirmado) quita la entrada de la lista", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }) as never
    );
    render(<SimulatedTradesPanel />);
    fireEvent.click(screen.getByText("Eliminar"));
    await waitFor(() =>
      expect(useSimulatedTradesStore.getState().tradesBySymbol.AAPL).toHaveLength(0)
    );
  });

  it("getOpenVisible solo devuelve abiertas y visibles (para los marcadores)", () => {
    useSimulatedTradesStore.setState({
      tradesBySymbol: {
        AAPL: [
          TRADE,
          { ...TRADE, id: 2, status: "CERRADA" },
          { ...TRADE, id: 3, visible: false },
        ],
      },
    });
    const open = useSimulatedTradesStore.getState().getOpenVisible("AAPL");
    expect(open.map((t) => t.id)).toEqual([1]);
  });
});
