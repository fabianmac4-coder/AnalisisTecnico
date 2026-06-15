// @vitest-environment jsdom
// Tests de la página de Inteligencia de Mercado + integración del prompt ChatGPT.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MarketIntelligencePage } from "./MarketIntelligencePage";
import { useMarketIntelligenceStore } from "./marketIntelligenceStore";
import type { MarketIntelligenceOverview } from "./marketIntelligenceTypes";
import { buildChatGptPrompt } from "@/features/chatgptIframe/chatGptPromptService";
import type {
  ChatGptContext,
  ChatGptContextToggles,
} from "@/features/chatgptIframe/chatGptIframeTypes";

const OVERVIEW: MarketIntelligenceOverview = {
  indices: [
    {
      symbol: "^GSPC", name: "S&P 500", price: 5432.1, change: 25.5,
      changePercent: 0.47, trend: "UP",
      sparkline: [{ time: 1, value: 5400 }, { time: 2, value: 5432 }],
      lastUpdated: null,
    },
    {
      symbol: "^VIX", name: "VIX (volatilidad)", price: 14.8, change: -0.2,
      changePercent: -1.3, trend: "DOWN", sparkline: [], lastUpdated: null,
    },
  ],
  sentiment: {
    score: 62, label: "GREED", confidence: "MEDIUM",
    source: "internal_market_sentiment_provider",
    components: [
      { name: "VIX", score: 75, status: "POSITIVE", value: 14.8,
        source: "Yahoo Finance", weight: 30, explanation: "Volatilidad baja." },
    ],
    warnings: [],
  },
  fearGreed: {
    enabled: true, value: 62, label: "GREED",
    source: "internal_market_sentiment_provider", lastUpdated: null, components: [],
  },
  marketMoversSummary: {
    topGainers: [{ symbol: "NVDA", name: "Nvidia", changePercent: 5.0 }],
    topLosers: [{ symbol: "INTC", name: "Intel", changePercent: -3.0 }],
    mostActive: [{ symbol: "AAPL", changePercent: 1.0, volume: 9000 }],
    trending: [{ symbol: "TSLA", changePercent: -0.5 }],
  },
  topNews: [
    {
      id: 1, title: "Stocks rally as Fed signals rate cut", publisher: "Reuters",
      provider: "YAHOO", category: "Markets", url: "http://example.com/a",
      publishedAt: null, relevanceReason: null,
    },
  ],
  whatThisMeans: [
    "Los principales índices muestran sesgo positivo hoy.",
    "El VIX está bajo: hay apetito por riesgo.",
  ],
  lastUpdated: "2026-06-15T12:00:00Z",
  fromCache: false,
  warnings: [],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  useMarketIntelligenceStore.setState({ overview: null, loading: false, error: null });
});
afterEach(() => cleanup());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/market-intelligence"]}>
      <Routes>
        <Route path="/market-intelligence" element={<MarketIntelligencePage />} />
        <Route path="/" element={<div>DASHBOARD</div>} />
        <Route path="/market-movers" element={<div>MOVERS</div>} />
        <Route path="/news" element={<div>NEWS</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MarketIntelligencePage", () => {
  it("renderiza la página con el gauge de sentimiento y su etiqueta", () => {
    useMarketIntelligenceStore.setState({ overview: OVERVIEW });
    renderPage();
    expect(screen.getByText("Inteligencia de Mercado")).toBeTruthy();
    expect(screen.getByTestId("fear-greed-gauge")).toBeTruthy();
    expect(screen.getByTestId("sentiment-score").textContent).toBe("62");
    expect(screen.getByTestId("sentiment-label").textContent).toBe("Codicia");
  });

  it("renderiza las tarjetas de índices principales", () => {
    useMarketIntelligenceStore.setState({ overview: OVERVIEW });
    renderPage();
    expect(screen.getByTestId("major-indices-panel")).toBeTruthy();
    expect(screen.getByTestId("index-card-^GSPC")).toBeTruthy();
    expect(screen.getByText("S&P 500")).toBeTruthy();
  });

  it("renderiza el resumen de movers y de noticias", () => {
    useMarketIntelligenceStore.setState({ overview: OVERVIEW });
    renderPage();
    expect(screen.getByTestId("movers-summary-panel")).toBeTruthy();
    expect(screen.getByText("NVDA")).toBeTruthy();
    expect(screen.getByTestId("news-summary-panel")).toBeTruthy();
    expect(screen.getByText("Stocks rally as Fed signals rate cut")).toBeTruthy();
  });

  it("renderiza los bullets de 'Qué significa esto'", () => {
    useMarketIntelligenceStore.setState({ overview: OVERVIEW });
    renderPage();
    expect(screen.getByTestId("what-this-means-panel")).toBeTruthy();
    expect(screen.getByText(/sesgo positivo hoy/)).toBeTruthy();
  });

  it("muestra estado de sentimiento no disponible sin romperse", () => {
    useMarketIntelligenceStore.setState({
      overview: {
        ...OVERVIEW,
        sentiment: { ...OVERVIEW.sentiment, score: null, label: "UNAVAILABLE", components: [] },
      },
    });
    renderPage();
    expect(screen.getByTestId("sentiment-unavailable")).toBeTruthy();
  });

  it("el botón actualizar usa forceRefresh=true", async () => {
    useMarketIntelligenceStore.setState({ overview: OVERVIEW });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(OVERVIEW) as never);
    renderPage();
    fireEvent.click(screen.getByTestId("market-intelligence-refresh"));
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((c) =>
        String(c[0]).includes("forceRefresh=true")
      );
      expect(call).toBeTruthy();
      expect(String(call![0])).toContain("/market-intelligence/overview");
    });
  });
});

describe("buildChatGptPrompt — sección Inteligencia de Mercado", () => {
  const ctx: ChatGptContext = { symbol: "AAPL" };
  const baseToggles: ChatGptContextToggles = {
    includePriceSummary: false,
    includeIndicators: false,
    includeDrawings: false,
    includeWatchlistNotes: false,
    includeFavoriteStatus: false,
    includeTimeframeSummary: false,
  };

  it("incluye el sentimiento y los índices cuando el toggle está activo", () => {
    const prompt = buildChatGptPrompt(
      "market_context_analysis",
      ctx,
      { ...baseToggles, includeMarketIntelligence: true },
      null, null, null, null,
      {
        sentiment: { score: 62, label: "GREED", confidence: "MEDIUM" },
        vix: 14.8,
        indices: [{ symbol: "^GSPC", changePercent: 0.47, trend: "UP" }],
        topGainer: "NVDA",
        topLoser: "INTC",
        topNews: ["Stocks rally"],
        whatThisMeans: ["Sesgo positivo"],
      }
    );
    expect(prompt).toContain("Inteligencia de mercado de hoy");
    expect(prompt).toContain("62/100");
    expect(prompt).toContain("VIX: 14.80");
    expect(prompt).toContain("NVDA");
  });

  it("no incluye la sección si el toggle está apagado", () => {
    const prompt = buildChatGptPrompt(
      "technical_analysis",
      ctx,
      { ...baseToggles, includeMarketIntelligence: false },
      null, null, null, null,
      { sentiment: { score: 62, label: "GREED", confidence: "MEDIUM" } }
    );
    expect(prompt).not.toContain("Inteligencia de mercado de hoy");
  });
});
