// @vitest-environment jsdom
// Tests del modo ChatGPT (iframe/helper): prompt builder, toggles, clipboard.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatGptIframeButton } from "./ChatGptIframeButton";
import { ChatGptIframePanel } from "./ChatGptIframePanel";
import { useChatGptIframeStore } from "./chatGptIframeStore";
import { buildChatGptPrompt } from "./chatGptPromptService";
import { CHATGPT_IFRAME_URL, type ChatGptContext } from "./chatGptIframeTypes";
import { useAiChatStore } from "@/features/aiChat/aiChatStore";
import { useChartStore } from "@/stores/chartStore";

const CONTEXT: ChatGptContext = {
  symbol: "AAPL",
  yahooSymbol: "AAPL",
  instrument: { name: "Apple Inc.", exchange: "NASDAQ", currency: "USD", sector: "Technology" },
  quote: { price: 291.58, change: -2.1, changePercent: -0.72, currency: "USD" },
  asOf: "2026-06-10",
  dailySummary: { yearHigh: 317.4, yearLow: 219.5, high20d: 305.2, low20d: 287.38 },
  indicatorValues: {
    sma20: 304.4,
    sma50: 283.94,
    rsi14: 43.78,
    macd: -1.234,
    macdSignal: -0.9,
    macdHist: -0.334,
    bbUpper: 312.5,
    bbMiddle: 304.4,
    bbLower: 296.3,
    volumeLast: 52_000_000,
    volumeAvg20: 40_000_000,
  },
  weeklySummary: { lastClose: 291.58, rsi14w: 51.2, sma10w: 295.1, sma40w: 266.0 },
  indicators: [],
  configuredValues: {
    "rsi-21": 47.5,
    "macd-5-35-5": { line: -0.8, signal: -0.5, histogram: -0.3 },
  },
  drawings: [
    {
      type: "free_line",
      sourceTimeframe: "1Y_1D",
      points: [
        { time: 1, date: "2025-11-14", price: 180 },
        { time: 2, date: "2026-01-11", price: 195 },
      ],
    },
  ],
  watchlist: { favorite: true, tags: ["AI"], notes: "Esperando pullback a SMA50" },
  timeframes: [
    { key: "4Y_1W", label: "", interval: "1wk" },
    { key: "1Y_1D", label: "", interval: "1d" },
  ],
};

const ALL_TOGGLES = {
  includePriceSummary: true,
  includeIndicators: true,
  includeDrawings: true,
  includeWatchlistNotes: true,
  includeFavoriteStatus: true,
  includeTimeframeSummary: true,
};

function resetStores() {
  useChatGptIframeStore.setState({
    isOpen: false,
    activeSymbol: null,
    activePromptType: "technical_analysis",
    context: null,
    generatedPrompt: "",
    loadingContext: false,
    error: null,
    notice: null,
    ...ALL_TOGGLES,
  });
  useChartStore.setState({ activeSymbol: "AAPL" });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  resetStores();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});
afterEach(() => cleanup());

describe("buildChatGptPrompt", () => {
  it("genera el prompt con ticker, precio, indicadores, dibujos y watchlist", () => {
    const prompt = buildChatGptPrompt("technical_analysis", CONTEXT, ALL_TOGGLES);
    expect(prompt).toContain("AAPL");
    expect(prompt).toContain("291.58");
    expect(prompt).toContain("SMA 20: 304.40");
    expect(prompt).toContain("free_line");
    expect(prompt).toContain("Favorito: Sí");
    expect(prompt).toContain("Esperando pullback a SMA50");
    expect(prompt).toContain("Zona de riesgo/invalidación");
    expect(prompt).toContain("análisis informativo");
  });

  it("incluye precision extra: fecha de corte, MACD, Bollinger, volumen, semanal y % vs precio", () => {
    const prompt = buildChatGptPrompt("technical_analysis", CONTEXT, ALL_TOGGLES);
    expect(prompt).toContain("datos al cierre del 2026-06-10");
    expect(prompt).toContain("MACD (12,26,9): línea -1.234, señal -0.900, histograma -0.334");
    expect(prompt).toContain("Bandas de Bollinger (20, 2σ): superior 312.50 / media 304.40 / inferior 296.30");
    expect(prompt).toContain("Volumen última sesión: 52.00M (x1.30 vs promedio 20d 40.00M)");
    expect(prompt).toContain("Contexto semanal (4 años)");
    expect(prompt).toContain("SMA 50: 283.94 (precio 2.7% por encima)");
    // Indicadores con los parametros del usuario.
    expect(prompt).toContain("rsi-21: 47.50");
    expect(prompt).toContain("macd-5-35-5: line -0.800, signal -0.500, histogram -0.300");
    // Dibujos con fecha @ precio.
    expect(prompt).toContain("2025-11-14 @ 180.00 → 2026-01-11 @ 195.00");
  });

  it("los toggles excluyen secciones del prompt", () => {
    const prompt = buildChatGptPrompt("technical_analysis", CONTEXT, {
      ...ALL_TOGGLES,
      includeDrawings: false,
      includeWatchlistNotes: false,
      includeFavoriteStatus: false,
    });
    expect(prompt).not.toContain("free_line");
    expect(prompt).not.toContain("watchlist");
    expect(prompt).not.toContain("Favorito:");
  });

  it("incluye entradas simuladas y R/R de canal cuando estan disponibles", () => {
    const withSims = {
      ...CONTEXT,
      simulatedEntries: [
        {
          type: "LONG",
          status: "ABIERTA",
          entryPrice: 185.25,
          entryDate: "2026-05-01T14:30:00",
          currentPrice: 195.3,
          gainLossPercent: 5.42,
          daysSinceEntry: 35,
          notes: "Entrada hipotética cerca de soporte",
        },
      ],
    };
    const prompt = buildChatGptPrompt("technical_analysis", withSims, ALL_TOGGLES, {
      referenceType: "simulated_entry",
      referencePrice: 185.25,
      targetTimeMs: 0,
      upperChannelPrice: 210,
      lowerChannelPrice: 176,
      potentialRewardPercent: 13.36,
      potentialRiskPercent: 4.99,
      ratio: 2.68,
      invalidReason: null,
    });
    expect(prompt).toContain("entradas simuladas (paper trading");
    expect(prompt).toContain("LONG (ABIERTA) entrada 185.25 el 2026-05-01");
    expect(prompt).toContain("resultado +5.42%");
    expect(prompt).toContain("Riesgo/beneficio de canal");
    expect(prompt).toContain("Canal superior: 210.00");
    expect(prompt).toContain("Ratio R/R: 2.68 : 1");
  });

  it("cada tipo de prompt cambia las peticiones", () => {
    const risk = buildChatGptPrompt("risk_analysis", CONTEXT, ALL_TOGGLES);
    expect(risk).toContain("invalidación");
    const drawings = buildChatGptPrompt("drawings_review", CONTEXT, ALL_TOGGLES);
    expect(drawings).toContain("mis dibujos");
  });
});

describe("ChatGptIframeButton", () => {
  it("abre el panel ChatGPT y cierra el AI Chat nativo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(CONTEXT), { status: 200 }) as never
    );
    useAiChatStore.setState({ isOpen: true });
    render(<ChatGptIframeButton />);
    fireEvent.click(screen.getByTestId("chatgpt-button"));
    await waitFor(() => expect(useChatGptIframeStore.getState().isOpen).toBe(true));
    expect(useAiChatStore.getState().isOpen).toBe(false); // exclusion mutua
  });
});

describe("ChatGptIframePanel", () => {
  function renderOpenPanel() {
    useChatGptIframeStore.setState({
      isOpen: true,
      activeSymbol: "AAPL",
      context: CONTEXT,
      generatedPrompt: buildChatGptPrompt("technical_analysis", CONTEXT, ALL_TOGGLES),
    });
    return render(<ChatGptIframePanel />);
  }

  it("muestra el ticker activo y el prompt generado en el preview", () => {
    renderOpenPanel();
    expect(screen.getByTestId("chatgpt-panel")).toBeTruthy();
    expect(screen.getByText("AAPL")).toBeTruthy();
    const preview = screen.getByTestId("chatgpt-prompt-preview") as HTMLTextAreaElement;
    expect(preview.value).toContain("Estoy analizando AAPL");
  });

  it("desmarcar un toggle regenera el prompt sin esa seccion", () => {
    renderOpenPanel();
    fireEvent.click(screen.getByTestId("chatgpt-toggle-includeDrawings"));
    const preview = screen.getByTestId("chatgpt-prompt-preview") as HTMLTextAreaElement;
    expect(preview.value).not.toContain("free_line");
  });

  it("cambiar el tipo de prompt regenera las peticiones", () => {
    renderOpenPanel();
    fireEvent.change(screen.getByTestId("chatgpt-prompt-type"), {
      target: { value: "support_resistance" },
    });
    const preview = screen.getByTestId("chatgpt-prompt-preview") as HTMLTextAreaElement;
    expect(preview.value).toContain("Soportes relevantes");
  });

  it("Copiar prompt usa el portapapeles y muestra aviso", async () => {
    renderOpenPanel();
    fireEvent.click(screen.getByTestId("chatgpt-copy-prompt"));
    await waitFor(() =>
      expect(screen.getByText("Prompt copiado. Pégalo en ChatGPT.")).toBeTruthy()
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("Estoy analizando AAPL")
    );
  });

  it("Abrir en pestaña nueva copia el prompt y abre la URL configurada", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    renderOpenPanel();
    fireEvent.click(screen.getByTestId("chatgpt-open-new-tab"));
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        CHATGPT_IFRAME_URL,
        "_blank",
        "noopener,noreferrer"
      )
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("muestra el aviso de fallback si el iframe no carga", () => {
    renderOpenPanel();
    // En jsdom el iframe no dispara onLoad: el aviso de fallback es visible.
    expect(screen.getByTestId("chatgpt-iframe-fallback").textContent).toContain(
      "pestaña nueva"
    );
  });

  it("el preview del prompt domina el panel y la guia es compacta/colapsable", () => {
    renderOpenPanel();
    // Preview con flex-1 (ocupa la altura restante del panel).
    const preview = screen.getByTestId("chatgpt-prompt-preview");
    expect(preview.className).toContain("flex-1");
    // La guia vive en un <details> colapsable, no en un bloque grande.
    const fallback = screen.getByTestId("chatgpt-iframe-fallback");
    expect(fallback.tagName.toLowerCase()).toBe("details");
    expect(fallback.textContent).toContain("¿Cómo se usa?");
    // Boton de copiar prominente presente.
    expect(screen.getByTestId("chatgpt-copy-prompt")).toBeTruthy();
  });
});
