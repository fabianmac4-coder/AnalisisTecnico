// @vitest-environment jsdom
// Tests del panel izquierdo de R/R de canal y del badge POR TEMPORALIDAD:
// el panel sigue a la grafica activa y cada badge solo muestra el canal de
// SU preset (sin contaminacion entre temporalidades).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { ChannelRiskRewardPanel } from "./ChannelRiskRewardPanel";
import { ChannelRiskRewardBadge } from "./ChannelRiskRewardBadge";
import { useChannelRiskRewardStore } from "./channelRiskRewardStore";
import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { useSymbolStore } from "@/stores/symbolStore";
import type { Drawing } from "@/features/drawings/drawingTypes";

const DAY = 86_400_000;
// Tiempos REALISTAS en ms (epoch 2026): normalizeChartTimeToMs no debe tocarlos.
const T0 = Date.UTC(2026, 0, 1);

function line(
  id: string,
  p1: { time: number; price: number },
  p2: { time: number; price: number },
  sourceTimeframe = "4Y_1W"
): Drawing {
  return {
    id,
    symbol: "AAPL",
    sourceTimeframe,
    type: "free_line",
    points: [p1, p2],
    style: { color: "#fff", width: 2, lineStyle: "solid", opacity: 1 },
    visible: true,
    locked: false,
    showOnAllTimeframes: true,
    createdAt: "",
    updatedAt: "",
    version: 3,
  } as Drawing;
}

// Canal en 4Y_1W: en la ultima vela (T0+10d) inferior=110, superior=125.
const LOWER_4Y = line("low4", { time: T0, price: 100 }, { time: T0 + 10 * DAY, price: 110 });
const UPPER_4Y = line("up4", { time: T0, price: 115 }, { time: T0 + 10 * DAY, price: 125 });

function bars(lastTimeMs: number) {
  return [
    { time: lastTimeMs - DAY, open: 110, high: 116, low: 109, close: 115, volume: 1000 },
    { time: lastTimeMs, open: 115, high: 118, low: 112, close: 117, volume: 1200 },
  ];
}

beforeEach(() => {
  localStorage.clear();
  useChannelRiskRewardStore.getState().reset();
  useChannelRiskRewardStore.setState({ activeChartPreset: null });
  useSymbolStore.setState({ activeSymbol: "AAPL" });
  useDrawingStore.setState({ drawingsBySymbol: { AAPL: [LOWER_4Y, UPPER_4Y] } });
  useChartStore.setState({
    quoteBySymbol: {
      AAPL: { symbol: "AAPL", price: 117, change: 1, changePercent: 0.9, currency: "USD" },
    } as never,
    chartDataByPreset: {
      "4Y_1W": { bars: bars(T0 + 10 * DAY) },
      "1Y_1D": { bars: bars(T0 + 10 * DAY) },
    } as never,
  });
});
afterEach(() => cleanup());

describe("ChannelRiskRewardPanel por temporalidad", () => {
  it("detecta el canal SOLO en su temporalidad de origen (4Y_1W, no 1Y_1D)", () => {
    render(<ChannelRiskRewardPanel />);
    const map = useChannelRiskRewardStore.getState().autoByTimeframe;
    expect(map["4Y_1W"]).toBeTruthy();
    expect(map["4Y_1W"]!.timeframe).toBe("4Y_1W");
    expect(map["1Y_1D"]).toBeNull();
    // Sin grafica activa, muestra el mejor disponible (4Y_1W).
    expect(screen.getByTestId("channel-auto-timeframe").textContent).toContain("4Y_1W");
    expect(screen.getByTestId("channel-rr-ratio")).toBeTruthy();
  });

  it("el panel sigue a la grafica ACTIVA y no mezcla ratios entre presets", () => {
    useChannelRiskRewardStore.setState({ activeChartPreset: "1Y_1D" });
    render(<ChannelRiskRewardPanel />);
    // En 1Y_1D no hay lineas de esa temporalidad: mensaje suave, sin ratio.
    expect(screen.getByTestId("channel-auto-timeframe").textContent).toContain("1Y_1D");
    expect(screen.getByTestId("channel-rr-none").textContent).toContain("1Y_1D");
    expect(screen.queryByTestId("channel-rr-ratio")).toBeNull();
  });

  it("al activar 4Y_1W vuelve a mostrar su canal", () => {
    useChannelRiskRewardStore.setState({ activeChartPreset: "4Y_1W" });
    render(<ChannelRiskRewardPanel />);
    expect(screen.getByTestId("channel-auto-timeframe").textContent).toContain("4Y_1W");
    // R/R = (125-117)/(117-110) = 8/7 ≈ 1.14
    expect(screen.getByTestId("channel-rr-ratio").textContent).toContain("1.14");
  });

  it("la seleccion manual sigue disponible pero colapsada por defecto", () => {
    render(<ChannelRiskRewardPanel />);
    expect(screen.getByTestId("channel-manual-toggle")).toBeTruthy();
    expect(screen.queryByTestId("channel-upper-select")).toBeNull();
    fireEvent.click(screen.getByTestId("channel-manual-toggle"));
    expect(screen.getByTestId("channel-upper-select")).toBeTruthy();
  });

  it("borrar una linea del canal quita el resultado", () => {
    const { rerender } = render(<ChannelRiskRewardPanel />);
    expect(useChannelRiskRewardStore.getState().autoByTimeframe["4Y_1W"]).toBeTruthy();
    useDrawingStore.setState({ drawingsBySymbol: { AAPL: [LOWER_4Y] } });
    rerender(<ChannelRiskRewardPanel />);
    expect(useChannelRiskRewardStore.getState().autoByTimeframe["4Y_1W"]).toBeFalsy();
    expect(screen.queryByTestId("channel-rr-ratio")).toBeNull();
  });
});

describe("ChannelRiskRewardBadge por preset", () => {
  it("muestra el badge solo en el preset con canal", () => {
    render(<ChannelRiskRewardPanel />); // publica autoByTimeframe
    const { container } = render(
      <div>
        <ChannelRiskRewardBadge preset="4Y_1W" />
        <ChannelRiskRewardBadge preset="1Y_1D" />
      </div>
    );
    const badges = container.querySelectorAll("[data-testid='channel-rr-badge']");
    expect(badges.length).toBe(1);
    expect(badges[0].getAttribute("data-preset")).toBe("4Y_1W");
    expect(badges[0].textContent).toContain("Canal R/R");
  });
});
