// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { StockScorecard } from "./StockScorecard";
import { useStockScorecardStore } from "./stockScorecardStore";
import { useSymbolStore } from "@/stores/symbolStore";
import { useAiChatStore } from "@/features/aiChat/aiChatStore";
import type { StockScorecardResponse } from "./stockScorecardTypes";

function makeScorecard(over: Partial<StockScorecardResponse> = {}): StockScorecardResponse {
  return {
    symbol: "AAPL",
    companyName: "Apple Inc.",
    technicalScore: 72,
    fundamentalScore: 64,
    newsScore: null,
    sentimentScore: null,
    overallScore: 68,
    riskLevel: "MEDIUM",
    confidenceLevel: "MEDIUM",
    overallView: "INTERESTING_BUT_WAIT_FOR_PULLBACK",
    summary: "AAPL es interesante pero conviene esperar confirmación.",
    strengths: ["Tendencia técnica positiva"],
    risks: ["Valuación exigente"],
    watchItems: ["SMA50 y SMA200"],
    dataAvailability: { technical: true, fundamentals: true, news: false, sentiment: false },
    lastUpdated: "2026-06-13T00:00:00Z",
    warnings: ["News data is limited."],
    ...over,
  };
}

function setScorecard(sc: StockScorecardResponse) {
  useSymbolStore.setState({ activeSymbol: "AAPL" });
  useStockScorecardStore.setState({
    bySymbol: { AAPL: sc },
    loadingBySymbol: {},
    errorBySymbol: {},
    expandedBySymbol: {},
    load: vi.fn().mockResolvedValue(undefined),
  });
}

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  useAiChatStore.setState({ openWithPrefill: vi.fn().mockResolvedValue(undefined) });
  setScorecard(makeScorecard());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StockScorecard", () => {
  it("se renderiza con la vista general, riesgo, confianza y mini-scores", () => {
    render(<StockScorecard />);
    expect(screen.getByTestId("stock-scorecard")).toBeTruthy();
    expect(screen.getByTestId("scorecard-overall-badge").getAttribute("data-view")).toBe(
      "INTERESTING_BUT_WAIT_FOR_PULLBACK"
    );
    expect(screen.getByTestId("scorecard-summary").textContent).toContain("AAPL");
    expect(screen.getByTestId("scorecard-mini-Téc").textContent).toContain("72");
    expect(screen.getByTestId("scorecard-mini-News").textContent).toContain("—");
    expect(screen.getByText(/Riesgo:/).textContent).toContain("Medio");
  });

  it("no muestra detalles hasta pulsar 'Ver detalles'", () => {
    render(<StockScorecard />);
    expect(screen.queryByTestId("scorecard-details")).toBeNull();
    fireEvent.click(screen.getByTestId("scorecard-toggle-details"));
    expect(screen.getByTestId("scorecard-details")).toBeTruthy();
    expect(screen.getByTestId("scorecard-strengths").textContent).toContain(
      "Tendencia técnica positiva"
    );
    expect(screen.getByTestId("scorecard-risks").textContent).toContain("Valuación exigente");
    expect(screen.getByTestId("scorecard-watch").textContent).toContain("SMA50 y SMA200");
  });

  it("el botón Refrescar llama load con forceRefresh", () => {
    render(<StockScorecard />);
    fireEvent.click(screen.getByTestId("scorecard-refresh"));
    expect(useStockScorecardStore.getState().load).toHaveBeenCalledWith("AAPL", true);
  });

  it("muestra el aviso de fundamentales limitados de forma limpia", () => {
    setScorecard(
      makeScorecard({
        fundamentalScore: null,
        dataAvailability: { technical: true, fundamentals: false, news: false, sentiment: false },
        warnings: ["Fundamental data is limited."],
      })
    );
    render(<StockScorecard />);
    fireEvent.click(screen.getByTestId("scorecard-toggle-details"));
    expect(screen.getByTestId("scorecard-warnings").textContent).toContain(
      "Fundamental data is limited."
    );
    expect(screen.getByTestId("scorecard-mini-Fund").textContent).toContain("—");
  });

  it("'Explícame con IA' abre el chat con un mensaje precargado", () => {
    render(<StockScorecard />);
    fireEvent.click(screen.getByTestId("scorecard-ask-ai"));
    const spy = useAiChatStore.getState().openWithPrefill as ReturnType<typeof vi.fn>;
    expect(spy).toHaveBeenCalled();
    const [symbol, message] = spy.mock.calls[0];
    expect(symbol).toBe("AAPL");
    expect(message).toContain("Stock Scorecard de AAPL");
  });

  it("'Copiar' copia el resumen al portapapeles", () => {
    render(<StockScorecard />);
    fireEvent.click(screen.getByTestId("scorecard-copy"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "AAPL es interesante pero conviene esperar confirmación."
    );
  });

  it("no renderiza nada sin símbolo activo (no rompe el layout)", () => {
    useSymbolStore.setState({ activeSymbol: null });
    const { container } = render(<StockScorecard />);
    expect(container.querySelector("[data-testid='stock-scorecard']")).toBeNull();
  });

  it("tiene botón 'Ver completo' que abre la vista completa", () => {
    render(<StockScorecard />);
    expect(screen.queryByTestId("scorecard-full-close")).toBeNull();
    fireEvent.click(screen.getByTestId("scorecard-open-full"));
    expect(screen.getByTestId("scorecard-full-close")).toBeTruthy();
  });
});
