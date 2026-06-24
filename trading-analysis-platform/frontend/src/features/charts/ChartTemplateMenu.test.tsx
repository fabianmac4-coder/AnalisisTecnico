// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  cleanup,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";

// Mocks: nada toca la red ni el chartStore real.
vi.mock("./userPreferencesApi", () => ({
  userPreferencesApi: {
    getTemplate: vi.fn(),
    saveTemplate: vi.fn(),
    resetTemplate: vi.fn(),
  },
}));
vi.mock("@/components/ui/toastStore", () => ({ showToast: vi.fn() }));
vi.mock("@/stores/chartStore", () => {
  const loadWorkspaceSlots = vi.fn().mockResolvedValue(undefined);
  return {
    useChartStore: (selector: (s: unknown) => unknown) =>
      selector({ loadWorkspaceSlots }),
    __loadWorkspaceSlots: loadWorkspaceSlots,
  };
});

import { ChartTemplateMenu } from "./ChartTemplateMenu";
import { useChartWorkspaceStore } from "./chartWorkspaceStore";
import { useChartTemplateStore } from "./chartTemplateStore";
import { userPreferencesApi } from "./userPreferencesApi";
import { showToast } from "@/components/ui/toastStore";
import * as chartStoreMock from "@/stores/chartStore";
import type { ChartWorkspace, ChartSlotConfig } from "./chartWorkspaceTypes";

const api = userPreferencesApi as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;
const loadWorkspaceSlots = (
  chartStoreMock as unknown as { __loadWorkspaceSlots: ReturnType<typeof vi.fn> }
).__loadWorkspaceSlots;

const SLOTS: ChartSlotConfig[] = [
  { slotId: "chart_1", range: "1Y", interval: "1h" },
  { slotId: "chart_2", range: "1Y", interval: "1d" },
  { slotId: "chart_3", range: "6M", interval: "1d" },
  { slotId: "chart_4", range: "3M", interval: "1d" },
  { slotId: "chart_5", range: "1M", interval: "1h" },
  { slotId: "chart_6", range: "1W", interval: "30m" },
];

const TEMPLATE_SLOTS: ChartSlotConfig[] = [
  { slotId: "chart_1", range: "5Y", interval: "1mo" },
  { slotId: "chart_2", range: "1Y", interval: "1wk" },
  { slotId: "chart_3", range: "6M", interval: "1d" },
  { slotId: "chart_4", range: "3M", interval: "1h" },
  { slotId: "chart_5", range: "1M", interval: "30m" },
  { slotId: "chart_6", range: "1D", interval: "5m" },
];

function activeWs(): ChartWorkspace {
  return {
    c030Id: 42,
    name: "Mi análisis",
    symbol: "AAPL",
    c010Id: 1,
    isDefault: true,
    chartSlots: SLOTS,
    configuration: {},
  };
}

let applyChartSlots: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // Por defecto la carga inicial devuelve el default del sistema.
  api.getTemplate.mockResolvedValue({
    source: "SYSTEM",
    chartSlots: SLOTS,
    isUserTemplate: false,
  });
  applyChartSlots = vi.fn().mockResolvedValue(TEMPLATE_SLOTS);
  useChartWorkspaceStore.setState({
    workspacesBySymbol: { AAPL: [activeWs()] },
    activeWorkspaceBySymbol: { AAPL: 42 },
    loading: false,
    saving: false,
    error: null,
    applyChartSlots,
  });
  useChartTemplateStore.setState({
    template: null,
    loading: false,
    saving: false,
    error: null,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openMenu() {
  fireEvent.click(screen.getByTestId("chart-template-button"));
}

describe("ChartTemplateMenu", () => {
  it("carga la plantilla al montar y muestra el source", async () => {
    render(<ChartTemplateMenu symbol="AAPL" />);
    await waitFor(() => expect(api.getTemplate).toHaveBeenCalled());
    openMenu();
    expect(screen.getByTestId("chart-template-source").textContent).toContain(
      "del sistema"
    );
  });

  it("el menú separa plantilla por defecto y este análisis (etiquetas español)", async () => {
    render(<ChartTemplateMenu symbol="AAPL" />);
    await waitFor(() => expect(api.getTemplate).toHaveBeenCalled());
    openMenu();
    const menu = screen.getByTestId("chart-template-menu");
    expect(menu.textContent).toContain("Guardar como plantilla predeterminada");
    expect(menu.textContent).toContain("Aplicar plantilla a este análisis");
    expect(menu.textContent).toContain("Restablecer plantilla del sistema");
    expect(menu.textContent).toContain("Plantilla por defecto");
    expect(menu.textContent).toContain("Este análisis");
  });

  it("Guardar: envía los slots, los aplica al workspace activo y recarga (sin 'Aplicar')", async () => {
    api.saveTemplate.mockResolvedValue({
      source: "USER",
      chartSlots: SLOTS,
      isUserTemplate: true,
    });
    render(<ChartTemplateMenu symbol="AAPL" />);
    await waitFor(() => expect(api.getTemplate).toHaveBeenCalled());
    openMenu();
    fireEvent.click(screen.getByTestId("chart-template-save"));
    await waitFor(() => expect(api.saveTemplate).toHaveBeenCalledWith(SLOTS));
    // Aplica al workspace ACTIVO (persiste C030) + recarga las seis gráficas.
    await waitFor(() =>
      expect(applyChartSlots).toHaveBeenCalledWith("AAPL", 42, SLOTS)
    );
    expect(loadWorkspaceSlots).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      "Plantilla predeterminada guardada y aplicada.",
      "success"
    );
    expect(useChartTemplateStore.getState().template?.source).toBe("USER");
  });

  it("Aplicar pide confirmación y cambia solo el workspace activo, recargando", async () => {
    // La plantilla efectiva (cargada al montar) tiene los slots de plantilla.
    api.getTemplate.mockResolvedValue({
      source: "USER",
      chartSlots: TEMPLATE_SLOTS,
      isUserTemplate: true,
    });
    render(<ChartTemplateMenu symbol="AAPL" />);
    await waitFor(() => expect(api.getTemplate).toHaveBeenCalled());
    openMenu();
    fireEvent.click(screen.getByTestId("chart-template-apply"));
    const modal = screen.getByTestId("chart-template-apply-modal");
    expect(modal.textContent).toContain(
      "Esto cambiará las seis gráficas de este análisis. Los dibujos se mantendrán."
    );
    fireEvent.click(screen.getByTestId("chart-template-apply-confirm"));
    await waitFor(() =>
      expect(applyChartSlots).toHaveBeenCalledWith("AAPL", 42, TEMPLATE_SLOTS)
    );
    expect(loadWorkspaceSlots).toHaveBeenCalledWith("AAPL", TEMPLATE_SLOTS);
    expect(showToast).toHaveBeenCalledWith(
      "Plantilla aplicada a este análisis.",
      "success"
    );
  });

  it("Cancelar en el modal de aplicar no cambia nada", async () => {
    render(<ChartTemplateMenu symbol="AAPL" />);
    await waitFor(() => expect(api.getTemplate).toHaveBeenCalled());
    openMenu();
    fireEvent.click(screen.getByTestId("chart-template-apply"));
    fireEvent.click(screen.getByTestId("chart-template-apply-cancel"));
    expect(screen.queryByTestId("chart-template-apply-modal")).toBeNull();
    expect(applyChartSlots).not.toHaveBeenCalled();
  });

  it("Restablecer: confirma, resetea, aplica el sistema al workspace activo y recarga", async () => {
    // Empieza con plantilla de usuario para ver el cambio a SYSTEM.
    useChartTemplateStore.setState({
      template: { source: "USER", chartSlots: TEMPLATE_SLOTS, isUserTemplate: true },
    });
    api.resetTemplate.mockResolvedValue({
      source: "SYSTEM",
      chartSlots: SLOTS,
      isUserTemplate: false,
    });
    render(<ChartTemplateMenu symbol="AAPL" />);
    openMenu();
    fireEvent.click(screen.getByTestId("chart-template-reset"));
    // Aparece confirmación; aún no llama al backend.
    expect(api.resetTemplate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("chart-template-reset-confirm"));
    await waitFor(() => expect(api.resetTemplate).toHaveBeenCalled());
    // Aplica el default del SISTEMA al workspace activo + recarga.
    await waitFor(() =>
      expect(applyChartSlots).toHaveBeenCalledWith("AAPL", 42, SLOTS)
    );
    expect(loadWorkspaceSlots).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      "Plantilla del sistema restablecida y aplicada.",
      "success"
    );
    expect(useChartTemplateStore.getState().template?.source).toBe("SYSTEM");
  });
});
