// @vitest-environment jsdom
// Tests del refresh manual y auto-refresh (timer con fake timers).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { RefreshButton } from "./RefreshButton";
import { AutoRefreshMenu } from "./AutoRefreshMenu";
import { useAutoRefresh } from "./useAutoRefresh";
import { useRefreshStore } from "./refreshStore";
import { AUTO_REFRESH_STORAGE_KEY } from "./refreshTypes";
import { useChartStore } from "@/stores/chartStore";
import { useDrawingStore } from "@/stores/drawingStore";

function resetRefreshStore() {
  useRefreshStore.setState({
    isRefreshing: false,
    lastRefreshedAt: null,
    autoRefreshIntervalMinutes: null,
    autoRefreshEnabled: false,
    error: null,
    notice: null,
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
  resetRefreshStore();
  useChartStore.setState({ activeSymbol: "AAPL" });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function HookHost({ symbol }: { symbol: string | null }) {
  useAutoRefresh(symbol);
  return null;
}

describe("RefreshButton", () => {
  it("se renderiza y dispara el refresh del simbolo activo", async () => {
    const spy = vi.fn().mockResolvedValue(true);
    useChartStore.setState({ refreshAllPresets: spy });
    render(<RefreshButton />);
    fireEvent.click(screen.getByTestId("refresh-button"));
    await waitFor(() => expect(spy).toHaveBeenCalledWith("AAPL"));
    // El simbolo activo se conserva.
    expect(useChartStore.getState().activeSymbol).toBe("AAPL");
  });

  it("muestra estado de carga y se deshabilita mientras refresca", () => {
    useRefreshStore.setState({ isRefreshing: true });
    render(<RefreshButton />);
    const button = screen.getByTestId("refresh-button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector(".animate-spin")).toBeTruthy();
  });

  it("deshabilitado sin simbolo activo", () => {
    useChartStore.setState({ activeSymbol: null });
    render(<RefreshButton />);
    expect((screen.getByTestId("refresh-button") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("refreshNow", () => {
  it("actualiza lastRefreshedAt y conserva dibujos al refrescar", async () => {
    useChartStore.setState({
      refreshAllPresets: vi.fn().mockResolvedValue(true),
    });
    useDrawingStore.setState({
      drawingsBySymbol: { AAPL: [{ id: "d1" } as never] },
    });
    await useRefreshStore.getState().refreshNow("AAPL");
    expect(useRefreshStore.getState().lastRefreshedAt).not.toBeNull();
    expect(useRefreshStore.getState().notice).toContain("actualizados");
    // Los dibujos no se tocan.
    expect(useDrawingStore.getState().drawingsBySymbol.AAPL).toHaveLength(1);
  });

  it("si el refresh falla, conserva datos y muestra error", async () => {
    useChartStore.setState({
      chartDataByPreset: { "1Y_1D": { bars: [{ time: 1 }] } as never },
      refreshAllPresets: vi.fn().mockResolvedValue(false),
    });
    await useRefreshStore.getState().refreshNow("AAPL");
    expect(useRefreshStore.getState().error).toContain("se conservan");
    expect(useRefreshStore.getState().lastRefreshedAt).toBeNull();
    expect(useChartStore.getState().chartDataByPreset["1Y_1D"]).toBeTruthy();
  });

  it("deduplica: no inicia otro refresh si ya hay uno en vuelo", async () => {
    const spy = vi.fn().mockResolvedValue(true);
    useChartStore.setState({ refreshAllPresets: spy });
    useRefreshStore.setState({ isRefreshing: true });
    await useRefreshStore.getState().refreshNow("AAPL");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("AutoRefreshMenu", () => {
  it("muestra las 4 opciones 5/10/15/20 y estado Off por defecto", () => {
    render(<AutoRefreshMenu />);
    expect(screen.getByTestId("auto-refresh-button").textContent).toContain("Off");
    fireEvent.click(screen.getByTestId("auto-refresh-button"));
    for (const m of [5, 10, 15, 20]) {
      expect(screen.getByTestId(`auto-refresh-${m}`)).toBeTruthy();
    }
  });

  it("comportamiento radio: solo una marcada; cambiar de 5 a 10 desmarca 5", () => {
    render(<AutoRefreshMenu />);
    fireEvent.click(screen.getByTestId("auto-refresh-button"));

    fireEvent.click(screen.getByTestId("auto-refresh-5"));
    expect((screen.getByTestId("auto-refresh-5") as HTMLInputElement).checked).toBe(true);
    expect(useRefreshStore.getState().autoRefreshIntervalMinutes).toBe(5);

    fireEvent.click(screen.getByTestId("auto-refresh-10"));
    expect((screen.getByTestId("auto-refresh-5") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId("auto-refresh-10") as HTMLInputElement).checked).toBe(true);
    expect(useRefreshStore.getState().autoRefreshIntervalMinutes).toBe(10);
  });

  it("re-clic en la opcion activa apaga el auto-refresh", () => {
    render(<AutoRefreshMenu />);
    fireEvent.click(screen.getByTestId("auto-refresh-button"));
    fireEvent.click(screen.getByTestId("auto-refresh-15"));
    fireEvent.click(screen.getByTestId("auto-refresh-15"));
    expect(useRefreshStore.getState().autoRefreshIntervalMinutes).toBeNull();
    expect(useRefreshStore.getState().autoRefreshEnabled).toBe(false);
    expect(screen.getByText("Estado: Manual")).toBeTruthy();
  });

  it("muestra la opción 'Cada 1 minuto' y al elegirla fija el intervalo a 1", () => {
    render(<AutoRefreshMenu />);
    fireEvent.click(screen.getByTestId("auto-refresh-button"));
    expect(screen.getByText("Cada 1 minuto")).toBeTruthy();
    fireEvent.click(screen.getByTestId("auto-refresh-1"));
    expect(useRefreshStore.getState().autoRefreshIntervalMinutes).toBe(1);
    expect((screen.getByTestId("auto-refresh-1") as HTMLInputElement).checked).toBe(true);
  });

  it("la opción Manual desactiva el auto-refresh", () => {
    useRefreshStore.setState({ autoRefreshIntervalMinutes: 5, autoRefreshEnabled: true });
    render(<AutoRefreshMenu />);
    fireEvent.click(screen.getByTestId("auto-refresh-button"));
    fireEvent.click(screen.getByTestId("auto-refresh-manual"));
    expect(useRefreshStore.getState().autoRefreshIntervalMinutes).toBeNull();
    expect(useRefreshStore.getState().autoRefreshEnabled).toBe(false);
  });

  it("persiste el intervalo en localStorage", () => {
    render(<AutoRefreshMenu />);
    fireEvent.click(screen.getByTestId("auto-refresh-button"));
    fireEvent.click(screen.getByTestId("auto-refresh-20"));
    expect(localStorage.getItem(AUTO_REFRESH_STORAGE_KEY)).toBe("20");
    // Apagar lo elimina.
    fireEvent.click(screen.getByTestId("auto-refresh-20"));
    expect(localStorage.getItem(AUTO_REFRESH_STORAGE_KEY)).toBeNull();
  });
});

describe("useAutoRefresh (timer)", () => {
  it("dispara refresh tras el intervalo seleccionado", () => {
    vi.useFakeTimers();
    const spy = vi.fn().mockResolvedValue(undefined);
    useRefreshStore.setState({ autoRefreshIntervalMinutes: 5, refreshNow: spy });
    render(<HookHost symbol="AAPL" />);

    act(() => vi.advanceTimersByTime(5 * 60 * 1000));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("AAPL");
  });

  it("con 'Cada 1 minuto' dispara el refresh a los 60 segundos", () => {
    vi.useFakeTimers();
    const spy = vi.fn().mockResolvedValue(undefined);
    useRefreshStore.setState({ autoRefreshIntervalMinutes: 1, refreshNow: spy });
    render(<HookHost symbol="AAPL" />);
    act(() => vi.advanceTimersByTime(60 * 1000));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("AAPL");
  });

  it("no se solapa: si hay un refresh en vuelo, salta el tick", () => {
    vi.useFakeTimers();
    const spy = vi.fn().mockResolvedValue(undefined);
    useRefreshStore.setState({
      autoRefreshIntervalMinutes: 5,
      refreshNow: spy,
      isRefreshing: true,
    });
    render(<HookHost symbol="AAPL" />);
    act(() => vi.advanceTimersByTime(5 * 60 * 1000));
    expect(spy).not.toHaveBeenCalled();
  });

  it("sin simbolo no hay timer; al desmontar se limpia", () => {
    vi.useFakeTimers();
    const spy = vi.fn().mockResolvedValue(undefined);
    useRefreshStore.setState({ autoRefreshIntervalMinutes: 5, refreshNow: spy });

    const { unmount } = render(<HookHost symbol={null} />);
    act(() => vi.advanceTimersByTime(10 * 60 * 1000));
    expect(spy).not.toHaveBeenCalled();
    unmount();

    const { unmount: unmount2 } = render(<HookHost symbol="AAPL" />);
    unmount2(); // desmontado antes del tick
    act(() => vi.advanceTimersByTime(10 * 60 * 1000));
    expect(spy).not.toHaveBeenCalled();
  });

  it("con la tab oculta se salta el tick", () => {
    vi.useFakeTimers();
    const spy = vi.fn().mockResolvedValue(undefined);
    useRefreshStore.setState({ autoRefreshIntervalMinutes: 5, refreshNow: spy });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    render(<HookHost symbol="AAPL" />);
    act(() => vi.advanceTimersByTime(5 * 60 * 1000));
    expect(spy).not.toHaveBeenCalled();
  });
});
