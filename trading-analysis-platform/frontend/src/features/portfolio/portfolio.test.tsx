// @vitest-environment jsdom
// Tests de Portfolio Analysis (Fase 4).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PortfolioPage } from "./PortfolioPage";
import { usePortfolioStore } from "./portfolioStore";
import type { Portfolio, PortfolioAnalysis } from "./portfolioTypes";

const PORTFOLIO: Portfolio = {
  c090Id: 1, name: "Largo plazo", description: null, baseCurrency: "USD",
  isDefault: true, active: true, createdAt: "2026-01-01", updatedAt: "2026-01-01",
};

function analysis(): PortfolioAnalysis {
  return {
    portfolio: { c090Id: 1, name: "Largo plazo", baseCurrency: "USD", lastUpdated: "2026-06-15T12:00:00Z" },
    summary: {
      totalCost: 1500, currentValue: 2000, totalGainLoss: 500, totalGainLossPercent: 33.33,
      positionCount: 1,
      bestPosition: { c091Id: 1, ticker: "AAPL", quantity: 10, averageCost: 150, currentPrice: 200, costBasis: 1500, currentValue: 2000, gainLoss: 500, gainLossPercent: 33.33, portfolioWeight: 100, sector: "Technology", dataWarnings: [] },
      worstPosition: { c091Id: 1, ticker: "AAPL", quantity: 10, averageCost: 150, currentPrice: 200, costBasis: 1500, currentValue: 2000, gainLoss: 500, gainLossPercent: 33.33, portfolioWeight: 100, sector: "Technology", dataWarnings: [] },
      cashValue: null,
    },
    positions: [
      { c091Id: 1, ticker: "AAPL", companyName: "Apple Inc.", quantity: 10, averageCost: 150, currentPrice: 200, costBasis: 1500, currentValue: 2000, gainLoss: 500, gainLossPercent: 33.33, portfolioWeight: 100, sector: "Technology", assetType: "STOCK", currency: "USD", dataWarnings: [] },
    ],
    allocation: {
      byPosition: [{ label: "AAPL", value: 2000, weight: 100 }],
      bySector: [{ label: "Technology", value: 2000, weight: 100 }],
      byIndustry: [], byAssetType: [{ label: "STOCK", value: 2000, weight: 100 }],
      byCurrency: [{ label: "USD", value: 2000, weight: 100 }],
    },
    risk: {
      concentrationRisk: { largestPositionTicker: "AAPL", largestPositionWeight: 100, top3Weight: 100, flagged: true },
      sectorRisk: { largestSector: "Technology", largestSectorWeight: 100, flagged: true },
      estimatedVolatility: null, estimatedBeta: null, sharpeRatio: null, maxDrawdown: null,
      correlationWarnings: [], advancedMetricsAvailable: false,
      advancedMetricsNote: "Las métricas de riesgo avanzadas requieren histórico y aún no están disponibles.",
      riskLevel: "HIGH_CONCENTRATION",
    },
    benchmark: { available: false, benchmarkSymbol: "^GSPC", benchmarkName: "S&P 500", message: "Comparación con el índice no disponible (faltan fechas de compra)." },
    recommendations: [{ type: "CONCENTRATION", severity: "HIGH", message: "AAPL representa el 100.0% del portafolio. Confirma si esta concentración es intencional." }],
    aiSummary: null, warnings: [],
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  usePortfolioStore.setState({
    portfolios: [], activeId: null, analysis: null, loading: false, analysisLoading: false,
    error: null, positionModalOpen: false, editingPosition: null, aiSummary: null, aiLoading: false, aiMessage: null,
  });
});
afterEach(() => cleanup());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/portfolio"]}>
      <Routes>
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/" element={<div>DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PortfolioPage", () => {
  it("muestra el estado vacío cuando no hay portafolios", () => {
    renderPage();
    expect(screen.getByTestId("portfolio-empty")).toBeTruthy();
  });

  it("renderiza resumen, tabla, asignación, riesgo, benchmark y recomendaciones", () => {
    usePortfolioStore.setState({ portfolios: [PORTFOLIO], activeId: 1, analysis: analysis() });
    renderPage();
    expect(screen.getByTestId("portfolio-summary")).toBeTruthy();
    expect(screen.getByTestId("positions-table")).toBeTruthy();
    const row = screen.getByTestId("position-row-1");
    expect(row.textContent).toContain("+33.33%"); // P/L % de la posición
    expect(row.textContent).toContain("100.0%"); // peso
    expect(screen.getByTestId("allocation-panel")).toBeTruthy();
    expect(screen.getByTestId("alloc-by-sector")).toBeTruthy();
    expect(screen.getByTestId("risk-panel")).toBeTruthy();
    expect(screen.getByTestId("risk-level-badge").textContent).toContain("concentración");
    expect(screen.getByTestId("risk-advanced-unavailable")).toBeTruthy();
  });

  it("el panel de benchmark muestra el estado no disponible limpio", () => {
    usePortfolioStore.setState({ portfolios: [PORTFOLIO], activeId: 1, analysis: analysis() });
    renderPage();
    expect(screen.getByTestId("benchmark-unavailable")).toBeTruthy();
  });

  it("muestra una recomendación de concentración", () => {
    usePortfolioStore.setState({ portfolios: [PORTFOLIO], activeId: 1, analysis: analysis() });
    renderPage();
    expect(screen.getAllByTestId("recommendation-item").length).toBe(1);
    expect(screen.getByText(/100.0% del portafolio/)).toBeTruthy();
  });

  it("el botón ＋ Posición abre el modal; guardar hace POST", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ c091Id: 2, c090Id: 1, ticker: "MSFT", assetType: "STOCK", quantity: 5, averageCost: 300 }, 201) as never
    );
    usePortfolioStore.setState({ portfolios: [PORTFOLIO], activeId: 1, analysis: analysis() });
    renderPage();
    fireEvent.click(screen.getByTestId("add-position-btn"));
    expect(screen.getByTestId("position-modal")).toBeTruthy();
    fireEvent.change(screen.getByTestId("position-ticker"), { target: { value: "MSFT" } });
    fireEvent.change(screen.getByTestId("position-quantity"), { target: { value: "5" } });
    fireEvent.change(screen.getByTestId("position-avgcost"), { target: { value: "300" } });
    fireEvent.click(screen.getByTestId("position-save"));
    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "POST" && String(c[0]).includes("/positions")
      );
      expect(post).toBeTruthy();
      const body = JSON.parse((post![1] as RequestInit).body as string);
      expect(body.ticker).toBe("MSFT");
      expect(body.quantity).toBe(5);
    });
  });

  it("el resumen de IA muestra el mensaje cuando no está disponible", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ available: false, summary: null, message: "Resumen de IA no disponible (IA no configurada)." }) as never
    );
    usePortfolioStore.setState({ portfolios: [PORTFOLIO], activeId: 1, analysis: analysis() });
    renderPage();
    fireEvent.click(screen.getByTestId("ai-summary-generate"));
    await waitFor(() => expect(screen.getByTestId("ai-summary-message")).toBeTruthy());
    expect(screen.getByText(/IA no configurada/)).toBeTruthy();
  });

  it("crear portafolio (vía prompt) hace POST a /portfolios", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Nuevo");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => {
      const u = String(url);
      const method = (init as RequestInit | undefined)?.method ?? "GET";
      if (u.includes("/portfolios") && method === "POST") {
        return Promise.resolve(jsonResponse({ ...PORTFOLIO, c090Id: 2, name: "Nuevo" }, 201) as never);
      }
      if (u.includes("/analysis")) return Promise.resolve(jsonResponse(analysis()) as never);
      return Promise.resolve(jsonResponse([{ ...PORTFOLIO, c090Id: 2, name: "Nuevo" }]) as never);
    });
    renderPage();
    fireEvent.click(screen.getByTestId("portfolio-create-empty"));
    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "POST" && String(c[0]).endsWith("/portfolios")
      );
      expect(post).toBeTruthy();
      expect(JSON.parse((post![1] as RequestInit).body as string).name).toBe("Nuevo");
    });
  });
});
