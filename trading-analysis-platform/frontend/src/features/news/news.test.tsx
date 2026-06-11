// @vitest-environment jsdom
// Tests de noticias (pagina global + panel por simbolo) y market movers.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NewsPage } from "./NewsPage";
import { SymbolNewsPanel } from "./SymbolNewsPanel";
import { useNewsStore } from "./newsStore";
import { MarketMoversPage } from "@/features/marketMovers/MarketMoversPage";
import { useMarketMoversStore } from "@/features/marketMovers/marketMoversStore";
import { useSymbolStore } from "@/stores/symbolStore";
import type { NewsItemDto } from "./newsTypes";

const ITEM: NewsItemDto = {
  id: 1,
  title: "Fed signals rate cut as inflation cools",
  summary: "Markets rallied after the announcement.",
  url: "https://example.com/fed",
  publisher: "Reuters",
  provider: "GOOGLE_NEWS",
  category: "Fed / Rates",
  publishedAt: "2026-06-11T12:00:00",
  fetchedAt: "2026-06-11T12:05:00",
  imageUrl: null,
  relatedTickers: [],
};

const MOVER = {
  symbol: "NVDA",
  name: "NVIDIA Corp",
  price: 1200.5,
  change: 50.2,
  changePercent: 4.36,
  volume: 30_000_000,
  marketCap: 2.9e12,
  ranking: 1,
  source: "YAHOO",
};

function moversData() {
  const list = { lastUpdated: "2026-06-11T12:00:00", items: [MOVER] };
  return {
    trending: list,
    topGainers: list,
    topLosers: { lastUpdated: null, items: [] },
    mostActive: list,
    warnings: [],
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  useNewsStore.setState({
    globalItems: [],
    globalCategory: "All",
    globalLastUpdated: null,
    globalLoading: false,
    globalError: null,
    globalWarnings: [],
    symbolItemsBySymbol: {},
    symbolLastUpdated: {},
    symbolLoading: false,
    symbolError: null,
  });
  useMarketMoversStore.setState({ data: null, activeTab: "trending", loading: false, error: null });
  useSymbolStore.setState({ activeSymbol: "AAPL", catalog: [] });
});
afterEach(() => cleanup());

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("NewsPage", () => {
  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/news"]}>
        <Routes>
          <Route path="/news" element={<NewsPage />} />
          <Route path="/" element={<div>DASHBOARD</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("muestra titulares con categoria y fuente; el link abre en pestaña nueva", () => {
    useNewsStore.setState({ globalItems: [ITEM] });
    renderPage();
    expect(screen.getByText("Fed signals rate cut as inflation cools")).toBeTruthy();
    const card = screen.getByTestId("news-card-1") as HTMLAnchorElement;
    expect(card.target).toBe("_blank");
    expect(card.href).toContain("example.com/fed");
    // El texto aparece en el chip de filtro Y en el badge de la tarjeta.
    expect(screen.getAllByText("Fed / Rates").length).toBeGreaterThanOrEqual(2);
  });

  it("el filtro de categoria llama a la API con la categoria", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ items: [ITEM], lastUpdated: null, fromCache: true, warnings: [] }) as never
    );
    renderPage();
    fireEvent.click(screen.getByTestId("news-filter-Energy"));
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((c) => String(c[0]).includes("/news/global"));
      expect(String(call![0])).toContain("category=Energy");
    });
  });

  it("el boton actualizar usa forceRefresh=true", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ items: [], lastUpdated: null, fromCache: false, warnings: [] }) as never
    );
    renderPage();
    fireEvent.click(screen.getByTestId("news-refresh"));
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((c) => String(c[0]).includes("forceRefresh=true"));
      expect(call).toBeTruthy();
    });
  });

  it("si la API falla, muestra error limpio y conserva titulares en cache", async () => {
    useNewsStore.setState({ globalItems: [ITEM] });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ detail: "proveedor caido" }, 502) as never
    );
    renderPage();
    fireEvent.click(screen.getByTestId("news-refresh"));
    await waitFor(() =>
      expect(screen.getByText(/se muestran los titulares en cache/i)).toBeTruthy()
    );
    expect(screen.getByText("Fed signals rate cut as inflation cools")).toBeTruthy();
  });
});

describe("SymbolNewsPanel", () => {
  it("muestra titulares del ticker activo con boton de refresh", () => {
    useNewsStore.setState({ symbolItemsBySymbol: { AAPL: [ITEM] } });
    render(<SymbolNewsPanel />);
    expect(screen.getByTestId("symbol-news-panel")).toBeTruthy();
    expect(screen.getByText(/Noticias AAPL/)).toBeTruthy();
    expect(screen.getByText(/Fed signals rate cut/)).toBeTruthy();
    expect(screen.getByTestId("symbol-news-refresh")).toBeTruthy();
  });

  it("sin noticias muestra mensaje claro", () => {
    render(<SymbolNewsPanel />);
    expect(screen.getByText("Sin noticias recientes de AAPL.")).toBeTruthy();
  });
});

describe("MarketMoversPage", () => {
  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/market-movers"]}>
        <Routes>
          <Route path="/market-movers" element={<MarketMoversPage />} />
          <Route path="/" element={<div>DASHBOARD</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("muestra las cuatro pestañas y la tabla con cambio % en verde", () => {
    useMarketMoversStore.setState({ data: moversData() as never });
    renderPage();
    for (const key of ["trending", "topGainers", "topLosers", "mostActive"]) {
      expect(screen.getByTestId(`movers-tab-${key}`)).toBeTruthy();
    }
    expect(screen.getByText("NVDA")).toBeTruthy();
    expect(screen.getByText("+4.36%")).toBeTruthy();
  });

  it("cambiar de pestaña muestra la lista correspondiente (vacia => mensaje)", () => {
    useMarketMoversStore.setState({ data: moversData() as never });
    renderPage();
    fireEvent.click(screen.getByTestId("movers-tab-topLosers"));
    expect(screen.getByText("Sin datos por ahora.")).toBeTruthy();
  });

  it("el boton actualizar usa forceRefresh", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(moversData()) as never
    );
    renderPage();
    fireEvent.click(screen.getByTestId("movers-refresh"));
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((c) =>
        String(c[0]).includes("/market-movers?forceRefresh=true")
      );
      expect(call).toBeTruthy();
    });
  });

  it("clic en el ticker navega al dashboard y selecciona el simbolo", async () => {
    useMarketMoversStore.setState({ data: moversData() as never });
    const searchSpy = vi.fn().mockResolvedValue(null);
    useSymbolStore.setState({ searchSymbol: searchSpy });
    renderPage();
    fireEvent.click(screen.getByTestId("mover-open-NVDA"));
    await waitFor(() => expect(screen.getByText("DASHBOARD")).toBeTruthy());
    expect(searchSpy).toHaveBeenCalledWith("NVDA");
  });

  it("agregar al watchlist avisa si ya existe", async () => {
    useMarketMoversStore.setState({ data: moversData() as never });
    useSymbolStore.setState({
      catalog: [
        {
          id: "1",
          symbol: "NVDA",
          provider: "yahoo",
          pinned: false,
          tags: [],
          lastViewedAt: "2026-01-01",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
    });
    renderPage();
    fireEvent.click(screen.getByTestId("mover-watchlist-NVDA"));
    await waitFor(() =>
      expect(screen.getByTestId("movers-toast").textContent).toContain("ya está")
    );
  });
});

describe("prompt ChatGPT con noticias", () => {
  it("incluye titulares recientes sin inventar noticias", async () => {
    const { buildChatGptPrompt } = await import(
      "@/features/chatgptIframe/chatGptPromptService"
    );
    const prompt = buildChatGptPrompt(
      "news_catalysts",
      {
        symbol: "AAPL",
        recentNews: [
          { title: "Apple unveils new AI chip", publisher: "Bloomberg", publishedAt: "2026-06-11T10:00:00" },
        ],
      },
      {
        includePriceSummary: false,
        includeIndicators: false,
        includeDrawings: false,
        includeWatchlistNotes: false,
        includeFavoriteStatus: false,
        includeTimeframeSummary: false,
      }
    );
    expect(prompt).toContain("Titulares recientes del instrumento");
    expect(prompt).toContain("Apple unveils new AI chip (Bloomberg, 2026-06-11)");
    expect(prompt).toContain("no inventes más noticias");
  });
});
