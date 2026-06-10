// @vitest-environment jsdom
// Smoke test: la app DEBE montar (sin pantalla en blanco) con storage limpio,
// con storage de versiones anteriores y con storage corrupto.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => cleanup());

describe("App smoke (sin pantalla en blanco)", () => {
  it("monta con localStorage limpio", () => {
    renderApp();
    expect(screen.getByText("Análisis Técnico")).toBeTruthy();
  });

  it("monta con estado persistido LEGADO (summary, ids viejos de indicadores, 4Y_1D)", () => {
    // layoutStore de la era "summary" (version 0, sin campos nuevos).
    localStorage.setItem(
      "tap.ui.v1",
      JSON.stringify({
        state: {
          currentView: "summary",
          sidebarCollapsed: false,
          theme: "dark",
          summaryFilters: { timeframes: { "4Y_1D": true }, typeFilter: "all" },
        },
        version: 0,
      })
    );
    // layout intermedio con indicadores del modelo viejo (sin name/style).
    localStorage.setItem(
      "tap.ui.v1",
      JSON.stringify({
        state: {
          sidebarCollapsed: false,
          theme: "dark",
          drawingVisibilityFilters: { "4Y_1D": true, "1Y_1D": true },
          timeframeDrawingColors: { "4Y_1D": "#f97316" },
          globalIndicators: [
            { id: "VOLUME", type: "VOLUME", params: {}, visible: true, applyToAllTimeframes: true },
            { id: "SMA_200", type: "SMA", params: { period: 200 }, visible: true, applyToAllTimeframes: true },
            { id: "RSI", type: "RSI", params: { period: 14 }, visible: false, applyToAllTimeframes: true, comingSoon: true },
          ],
        },
        version: 2,
      })
    );
    // Dibujos legados (trendline, 4Y_1D, sin showOnAllTimeframes/version).
    localStorage.setItem(
      "tap.drawings.v1",
      JSON.stringify({
        AAPL: [
          {
            id: "old1",
            symbol: "AAPL",
            sourceTimeframe: "4Y_1D",
            type: "trendline",
            points: [
              { time: 1, price: 1 },
              { time: 2, price: 2 },
            ],
            style: { color: "#fff", width: 2, lineStyle: "solid", opacity: 1 },
            visible: true,
            locked: false,
            showOnSummary: true,
            showOnTimeframes: ["4Y_1D"],
            createdAt: "",
            updatedAt: "",
            version: 1,
          },
        ],
      })
    );
    // Catalogo viejo.
    localStorage.setItem(
      "tap.catalog.v1",
      JSON.stringify({
        AAPL: {
          id: "1",
          symbol: "AAPL",
          provider: "yahoo",
          pinned: false,
          tags: [],
          lastViewedAt: "2025-01-01",
          createdAt: "2025-01-01",
          updatedAt: "2025-01-01",
        },
      })
    );
    renderApp();
    expect(screen.getByText("Análisis Técnico")).toBeTruthy();
  });

  it("monta con localStorage CORRUPTO (JSON invalido en todas las claves)", () => {
    localStorage.setItem("tap.ui.v1", "{corrupto!!");
    localStorage.setItem("tap.drawings.v1", "no-json");
    localStorage.setItem("tap.catalog.v1", "[broken");
    localStorage.setItem("tap.layout.v1", "{{{{");
    renderApp();
    expect(screen.getByText("Análisis Técnico")).toBeTruthy();
  });

  it("monta con globalIndicators persistido como objeto invalido (no array)", () => {
    localStorage.setItem(
      "tap.ui.v1",
      JSON.stringify({ state: { globalIndicators: { bogus: true } }, version: 3 })
    );
    renderApp();
    expect(screen.getByText("Análisis Técnico")).toBeTruthy();
  });
});
