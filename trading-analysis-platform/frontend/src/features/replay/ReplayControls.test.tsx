// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { ReplayControls } from "./ReplayControls";
import { useReplayStore } from "./replayStore";

const TIMES = [10, 20, 30, 40, 50];

function resetReplay(partial: Partial<ReturnType<typeof useReplayStore.getState>> = {}) {
  useReplayStore.setState({
    enabled: false,
    symbol: null,
    cursorTime: null,
    speedMultiplier: 1,
    playing: false,
    selecting: false,
    ...partial,
  });
}

beforeEach(() => resetReplay());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ReplayControls", () => {
  it("apagado: muestra 'Modo Replay' y al activarlo entra en replay con cursor", () => {
    render(<ReplayControls symbol="AAPL" referenceTimes={TIMES} />);
    fireEvent.click(screen.getByTestId("replay-enable"));
    const s = useReplayStore.getState();
    expect(s.enabled).toBe(true);
    expect(s.symbol).toBe("AAPL");
    expect(s.cursorTime).toBe(10); // defaultReplayCursor con 5 velas => primera
  });

  it("'Modo Replay' deshabilitado si no hay velas de referencia", () => {
    render(<ReplayControls symbol="AAPL" referenceTimes={[]} />);
    expect((screen.getByTestId("replay-enable") as HTMLButtonElement).disabled).toBe(true);
  });

  it("activo: muestra el badge y los controles", () => {
    resetReplay({ enabled: true, symbol: "AAPL", cursorTime: 30 });
    render(<ReplayControls symbol="AAPL" referenceTimes={TIMES} />);
    expect(screen.getByTestId("replay-controls")).toBeTruthy();
    expect(screen.getByTestId("replay-badge").textContent).toContain("Replay activo");
    expect(screen.getByTestId("replay-step-forward")).toBeTruthy();
    expect(screen.getByTestId("replay-step-back")).toBeTruthy();
    expect(screen.getByTestId("replay-play")).toBeTruthy();
    expect(screen.getByTestId("replay-disable")).toBeTruthy();
  });

  it("Avanzar vela mueve el cursor a la siguiente", () => {
    resetReplay({ enabled: true, symbol: "AAPL", cursorTime: 30 });
    render(<ReplayControls symbol="AAPL" referenceTimes={TIMES} />);
    fireEvent.click(screen.getByTestId("replay-step-forward"));
    expect(useReplayStore.getState().cursorTime).toBe(40);
  });

  it("Retroceder vela mueve el cursor a la anterior", () => {
    resetReplay({ enabled: true, symbol: "AAPL", cursorTime: 30 });
    render(<ReplayControls symbol="AAPL" referenceTimes={TIMES} />);
    fireEvent.click(screen.getByTestId("replay-step-back"));
    expect(useReplayStore.getState().cursorTime).toBe(20);
  });

  it("Avanzar deshabilitado en la última vela", () => {
    resetReplay({ enabled: true, symbol: "AAPL", cursorTime: 50 });
    render(<ReplayControls symbol="AAPL" referenceTimes={TIMES} />);
    expect((screen.getByTestId("replay-step-forward") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Retroceder deshabilitado en la primera vela", () => {
    resetReplay({ enabled: true, symbol: "AAPL", cursorTime: 10 });
    render(<ReplayControls symbol="AAPL" referenceTimes={TIMES} />);
    expect((screen.getByTestId("replay-step-back") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Reproducir/Pausar alterna el estado playing", () => {
    resetReplay({ enabled: true, symbol: "AAPL", cursorTime: 30 });
    render(<ReplayControls symbol="AAPL" referenceTimes={TIMES} />);
    fireEvent.click(screen.getByTestId("replay-play"));
    expect(useReplayStore.getState().playing).toBe(true);
    fireEvent.click(screen.getByTestId("replay-play"));
    expect(useReplayStore.getState().playing).toBe(false);
  });

  it("Velocidad cambia el multiplicador", () => {
    resetReplay({ enabled: true, symbol: "AAPL", cursorTime: 30 });
    render(<ReplayControls symbol="AAPL" referenceTimes={TIMES} />);
    fireEvent.change(screen.getByTestId("replay-speed"), { target: { value: "5" } });
    expect(useReplayStore.getState().speedMultiplier).toBe(5);
  });

  it("Desactivar Replay sale del modo", () => {
    resetReplay({ enabled: true, symbol: "AAPL", cursorTime: 30 });
    render(<ReplayControls symbol="AAPL" referenceTimes={TIMES} />);
    fireEvent.click(screen.getByTestId("replay-disable"));
    expect(useReplayStore.getState().enabled).toBe(false);
    expect(useReplayStore.getState().cursorTime).toBeNull();
  });

  it("Fecha de corte fija el cursor al instante elegido", () => {
    resetReplay({ enabled: true, symbol: "AAPL", cursorTime: 30 });
    render(<ReplayControls symbol="AAPL" referenceTimes={TIMES} />);
    fireEvent.change(screen.getByTestId("replay-cutoff-input"), {
      target: { value: "2024-01-02T03:04" },
    });
    const expected = new Date("2024-01-02T03:04").getTime();
    expect(useReplayStore.getState().cursorTime).toBe(expected);
  });

  it("Seleccionar punto de inicio arma el modo selección", () => {
    resetReplay({ enabled: true, symbol: "AAPL", cursorTime: 30 });
    render(<ReplayControls symbol="AAPL" referenceTimes={TIMES} />);
    fireEvent.click(screen.getByTestId("replay-select-start"));
    expect(useReplayStore.getState().selecting).toBe(true);
  });
});
