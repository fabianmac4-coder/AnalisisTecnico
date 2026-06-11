// @vitest-environment jsdom
// Tests del watchlist: confirmacion al quitar, estrella de favoritos, filtro.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { SymbolCatalog } from "./SymbolCatalog";
import { useSymbolStore } from "@/stores/symbolStore";
import type { CatalogSymbol } from "./symbolTypes";

function entry(symbol: string, pinned = false, lastViewedAt = "2026-06-10"): CatalogSymbol {
  return {
    id: symbol,
    symbol,
    name: `${symbol} Inc.`,
    provider: "yahoo",
    pinned,
    tags: [],
    lastViewedAt,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  useSymbolStore.setState({
    catalog: [entry("AAPL"), entry("MSFT", true, "2026-06-09")],
    activeSymbol: null,
  });
});
afterEach(() => cleanup());

describe("watchlist", () => {
  it("quitar muestra modal de confirmación; Cancelar no quita nada", () => {
    render(<SymbolCatalog />);
    fireEvent.click(screen.getByTestId("remove-AAPL"));
    expect(screen.getByText("¿Quitar del watchlist?")).toBeTruthy();
    expect(screen.getByText(/no se borran/)).toBeTruthy();

    fireEvent.click(screen.getByTestId("remove-cancel"));
    expect(screen.queryByText("¿Quitar del watchlist?")).toBeNull();
    expect(useSymbolStore.getState().catalog).toHaveLength(2); // sigue ahi
  });

  it("Confirmar quita el ticker y muestra el toast", async () => {
    render(<SymbolCatalog />);
    fireEvent.click(screen.getByTestId("remove-AAPL"));
    fireEvent.click(screen.getByTestId("remove-confirm"));

    await waitFor(() =>
      expect(screen.getByTestId("watchlist-toast").textContent).toContain(
        "AAPL se quitó de tu watchlist"
      )
    );
    expect(useSymbolStore.getState().catalog.map((c) => c.symbol)).toEqual(["MSFT"]);
  });

  it("la estrella alterna el estado de favorito", async () => {
    render(<SymbolCatalog />);
    const star = screen.getByTestId("favorite-star-AAPL");
    expect(star.textContent).toBe("☆");
    fireEvent.click(star);
    await waitFor(() => {
      const aapl = useSymbolStore.getState().catalog.find((c) => c.symbol === "AAPL");
      expect(aapl?.pinned).toBe(true);
    });
    expect(screen.getByTestId("favorite-star-AAPL").textContent).toBe("★");
  });

  it("el filtro Solo favoritos oculta los no favoritos", () => {
    render(<SymbolCatalog />);
    expect(screen.getByText("AAPL")).toBeTruthy();
    fireEvent.click(screen.getByTestId("favorites-only-filter"));
    expect(screen.queryByText("AAPL")).toBeNull();
    expect(screen.getByText("MSFT")).toBeTruthy(); // MSFT es favorito
  });

  it("los favoritos aparecen primero aunque sean menos recientes", () => {
    render(<SymbolCatalog />);
    const items = screen.getAllByRole("listitem");
    // MSFT (favorito, visto 06-09) antes que AAPL (no favorito, visto 06-10).
    expect(items[0].textContent).toContain("MSFT");
    expect(items[1].textContent).toContain("AAPL");
  });
});
