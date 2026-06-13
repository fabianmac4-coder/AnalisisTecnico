// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { WorkspaceTabBar } from "./WorkspaceTabBar";
import { useChartWorkspaceStore } from "./chartWorkspaceStore";
import type { ChartWorkspace } from "./chartWorkspaceTypes";

function ws(c030Id: number, name: string, isDefault = false): ChartWorkspace {
  return {
    c030Id,
    name,
    symbol: "AAPL",
    c010Id: 1,
    isDefault,
    chartSlots: [],
    configuration: {},
  };
}

function setWorkspaces(list: ChartWorkspace[], activeId = list[0]?.c030Id) {
  useChartWorkspaceStore.setState({
    workspacesBySymbol: { AAPL: list },
    activeWorkspaceBySymbol: activeId ? { AAPL: activeId } : {},
    loading: false,
    saving: false,
    error: null,
    createWorkspace: vi.fn().mockResolvedValue(undefined),
    renameWorkspace: vi.fn().mockResolvedValue(undefined),
    duplicateWorkspace: vi.fn().mockResolvedValue(undefined),
    deleteWorkspace: vi.fn().mockResolvedValue(undefined),
    setDefaultWorkspace: vi.fn().mockResolvedValue(undefined),
  });
}

function openMenu(c030Id: number) {
  fireEvent.click(screen.getByTestId(`workspace-menu-button-${c030Id}`));
}

beforeEach(() => {
  setWorkspaces([ws(1, "Long-term", true), ws(2, "Short-term")]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WorkspaceTabBar", () => {
  it("renderiza una pestaña por workspace y el botón de nuevo análisis", () => {
    render(<WorkspaceTabBar symbol="AAPL" />);
    expect(screen.getByTestId("workspace-tab-bar")).toBeTruthy();
    expect(screen.getByTestId("workspace-tab-1").textContent).toContain("Long-term");
    expect(screen.getByTestId("workspace-tab-2").textContent).toContain("Short-term");
    expect(screen.getByTestId("workspace-new")).toBeTruthy();
  });

  it("el menú muestra Renombrar, Duplicar, Marcar por defecto y Eliminar", () => {
    render(<WorkspaceTabBar symbol="AAPL" />);
    openMenu(2);
    const menu = screen.getByTestId("workspace-menu");
    expect(menu.textContent).toContain("Renombrar");
    expect(menu.textContent).toContain("Duplicar");
    expect(menu.textContent).toContain("Marcar por defecto");
    expect(menu.textContent).toContain("Eliminar");
  });

  it("el workspace por defecto muestra la estrella y su menú indica 'Ya es predeterminado'", () => {
    render(<WorkspaceTabBar symbol="AAPL" />);
    expect(screen.getByTestId("workspace-default-1")).toBeTruthy();
    openMenu(1);
    expect(screen.getByTestId("workspace-menu").textContent).toContain(
      "Ya es predeterminado"
    );
  });

  it("cambiar de pestaña llama setActiveWorkspace", () => {
    render(<WorkspaceTabBar symbol="AAPL" />);
    fireEvent.click(screen.getByText("Short-term"));
    expect(useChartWorkspaceStore.getState().activeWorkspaceBySymbol.AAPL).toBe(2);
  });

  it("crear nuevo análisis pide nombre y llama createWorkspace", () => {
    vi.spyOn(window, "prompt").mockReturnValue("Scalping");
    render(<WorkspaceTabBar symbol="AAPL" />);
    fireEvent.click(screen.getByTestId("workspace-new"));
    expect(useChartWorkspaceStore.getState().createWorkspace).toHaveBeenCalledWith(
      "AAPL",
      "Scalping"
    );
  });

  it("renombrar inline guarda el nuevo nombre", () => {
    render(<WorkspaceTabBar symbol="AAPL" />);
    openMenu(2);
    fireEvent.click(screen.getByText("Renombrar"));
    const input = screen.getByTestId("workspace-rename-input-2");
    fireEvent.change(input, { target: { value: "Swing" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useChartWorkspaceStore.getState().renameWorkspace).toHaveBeenCalledWith(
      "AAPL",
      2,
      "Swing"
    );
  });

  it("duplicar llama duplicateWorkspace con sufijo Copy", () => {
    render(<WorkspaceTabBar symbol="AAPL" />);
    openMenu(2);
    fireEvent.click(screen.getByText("Duplicar"));
    expect(useChartWorkspaceStore.getState().duplicateWorkspace).toHaveBeenCalledWith(
      "AAPL",
      2,
      "Short-term Copy"
    );
  });

  it("marcar por defecto llama setDefaultWorkspace", () => {
    render(<WorkspaceTabBar symbol="AAPL" />);
    openMenu(2);
    fireEvent.click(screen.getByText("Marcar por defecto"));
    expect(useChartWorkspaceStore.getState().setDefaultWorkspace).toHaveBeenCalledWith(
      "AAPL",
      2
    );
  });

  it("eliminar abre modal de confirmación; cancelar no borra", () => {
    render(<WorkspaceTabBar symbol="AAPL" />);
    openMenu(2);
    fireEvent.click(screen.getByText("Eliminar"));
    expect(screen.getByTestId("workspace-delete-modal")).toBeTruthy();
    fireEvent.click(screen.getByTestId("workspace-delete-cancel"));
    expect(screen.queryByTestId("workspace-delete-modal")).toBeNull();
    expect(useChartWorkspaceStore.getState().deleteWorkspace).not.toHaveBeenCalled();
  });

  it("confirmar borrado llama deleteWorkspace", () => {
    render(<WorkspaceTabBar symbol="AAPL" />);
    openMenu(2);
    fireEvent.click(screen.getByText("Eliminar"));
    fireEvent.click(screen.getByTestId("workspace-delete-confirm"));
    expect(useChartWorkspaceStore.getState().deleteWorkspace).toHaveBeenCalledWith("AAPL", 2);
  });

  it("eliminar el último workspace se bloquea sin abrir modal ni borrar", () => {
    setWorkspaces([ws(1, "Solo", true)]);
    render(<WorkspaceTabBar symbol="AAPL" />);
    openMenu(1);
    fireEvent.click(screen.getByText("Eliminar"));
    expect(screen.queryByTestId("workspace-delete-modal")).toBeNull();
    expect(useChartWorkspaceStore.getState().deleteWorkspace).not.toHaveBeenCalled();
  });
});
