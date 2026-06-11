// @vitest-environment jsdom
// Tests de las mejoras de noticias (trending panel, filtros, fuente) y del
// prompt de ChatGPT con contexto global + canal auto.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NewsPage } from "./NewsPage";
import { TopTrendingStocksTodayPanel } from "./TopTrendingStocksTodayPanel";
import { useNewsStore } from "./newsStore";
import { useSymbolStore } from "@/stores/symbolStore";
import { buildChatGptPrompt } from "@/features/chatgptIframe/chatGptPromptService";
import type { NewsItemDto } from "./newsTypes";

const TRENDING_ITEM: NewsItemDto = {
  id: 9,
  title: "Biggest movers today: NVDA surges on AI demand",
  summary: null,
  url: "https://example.com/movers",
  publisher: "Yahoo Finance",
  provider: "YAHOO_FINANCE_TRENDING_STOCKS",
  category: "Top Trending Stocks Today",
  publishedAt: "2026-06-12T12:00:00",
  fetchedAt: "2026-06-12T12:01:00",
  imageUrl: null,
  relatedTickers: ["NVDA"],
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  useNewsStore.setState({
    globalItems: [],
    globalCategory: "All",
    globalSource: "all",
    globalLastUpdated: null,
    globalLoading: false,
    globalError: null,
    globalWarnings: [],
    trendingItems: [],
    trendingLastUpdated: null,
    trendingLoading: false,
    symbolItemsBySymbol: {},
    symbolLastUpdated: {},
    symbolLoading: false,
    symbolError: null,
  });
  useSymbolStore.setState({ activeSymbol: "AAPL", catalog: [] });
});
afterEach(() => cleanup());

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function renderNewsPage() {
  return render(
    <MemoryRouter initialEntries={["/news"]}>
      <Routes>
        <Route path="/news" element={<NewsPage />} />
        <Route path="/" element={<div>DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("NewsPage mejorada", () => {
  it("muestra la seccion Top Trending Stocks Today y los filtros nuevos", () => {
    renderNewsPage();
    expect(screen.getByTestId("trending-stocks-panel")).toBeTruthy();
    expect(screen.getByTestId("news-filter-Top Trending Stocks Today")).toBeTruthy();
    expect(screen.getByTestId("news-filter-Geopolitics / Policy")).toBeTruthy();
  });

  it("el filtro de fuente llama a la API con source=yahoo", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ items: [], lastUpdated: null, fromCache: true, warnings: [] }) as never
    );
    renderNewsPage();
    fireEvent.click(screen.getByTestId("news-source-yahoo"));
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((c) => String(c[0]).includes("source=yahoo"));
      expect(call).toBeTruthy();
    });
  });

  it("filtro sin resultados muestra mensaje claro", () => {
    renderNewsPage();
    expect(screen.getByText(/No hay titulares para este filtro/)).toBeTruthy();
  });
});

describe("TopTrendingStocksTodayPanel", () => {
  it("muestra titulares con badge de ticker; el badge abre la grafica", async () => {
    useNewsStore.setState({ trendingItems: [TRENDING_ITEM] });
    const searchSpy = vi.fn().mockResolvedValue(null);
    useSymbolStore.setState({ searchSymbol: searchSpy });
    render(
      <MemoryRouter initialEntries={["/news"]}>
        <Routes>
          <Route path="/news" element={<TopTrendingStocksTodayPanel />} />
          <Route path="/" element={<div>DASHBOARD</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/Biggest movers today/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("trending-ticker-NVDA"));
    await waitFor(() => expect(screen.getByText("DASHBOARD")).toBeTruthy());
    expect(searchSpy).toHaveBeenCalledWith("NVDA");
  });

  it("el refresh del panel usa forceRefresh", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ items: [], lastUpdated: null, fromCache: false, warnings: [] }) as never
    );
    render(
      <MemoryRouter>
        <TopTrendingStocksTodayPanel />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId("trending-refresh"));
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((c) =>
        String(c[0]).includes("/news/top-trending-stocks-today?") &&
        String(c[0]).includes("forceRefresh=true")
      );
      expect(call).toBeTruthy();
    });
  });

  it("sin titulares de hoy muestra el mensaje de vacio", () => {
    render(
      <MemoryRouter>
        <TopTrendingStocksTodayPanel />
      </MemoryRouter>
    );
    expect(screen.getByText(/Aún no hay titulares/)).toBeTruthy();
  });
});

describe("prompt ChatGPT con contexto global y canal auto", () => {
  const TOGGLES = {
    includePriceSummary: false,
    includeIndicators: false,
    includeDrawings: false,
    includeWatchlistNotes: false,
    includeFavoriteStatus: false,
    includeTimeframeSummary: false,
  };

  it("incluye titulares globales y de acciones en movimiento", () => {
    const prompt = buildChatGptPrompt(
      "news_catalysts",
      {
        symbol: "AAPL",
        recentGlobalMarketNews: [
          { title: "Fed holds rates steady", publisher: "Reuters" },
        ],
        topTrendingStocksTodayNews: [
          { title: "NVDA surges on AI demand", publisher: "Yahoo Finance" },
        ],
      },
      TOGGLES
    );
    expect(prompt).toContain("Contexto de mercado reciente");
    expect(prompt).toContain("Fed holds rates steady (Reuters)");
    expect(prompt).toContain("Acciones en movimiento hoy:");
    expect(prompt).toContain("NVDA surges on AI demand (Yahoo Finance)");
  });

  it("el canal auto-detectado se etiqueta como AUTO en el prompt", () => {
    const prompt = buildChatGptPrompt(
      "technical_analysis",
      { symbol: "AAPL" },
      TOGGLES,
      {
        referenceType: "current_price",
        referencePrice: 185.25,
        targetTimeMs: 0,
        upperChannelPrice: 210,
        lowerChannelPrice: 176,
        potentialRewardPercent: 13.36,
        potentialRiskPercent: 4.99,
        ratio: 2.68,
        invalidReason: null,
      }
    );
    expect(prompt).toContain("AUTO-detectado");
    expect(prompt).toContain("Ratio R/R: 2.68 : 1");
  });
});
