import { describe, it, expect, beforeEach, vi } from "vitest";
import type { StockScorecardResponse } from "./stockScorecardTypes";
import {
  OVERALL_VIEW_LABEL,
  buildScorecardExplainMessage,
} from "./stockScorecardTypes";
import { buildChatGptPrompt } from "@/features/chatgptIframe/chatGptPromptService";
import type {
  ChatGptContext,
  ChatGptContextToggles,
} from "@/features/chatgptIframe/chatGptIframeTypes";

vi.mock("./stockScorecardService", () => ({
  stockScorecardService: { get: vi.fn() },
}));

import { stockScorecardService } from "./stockScorecardService";
import { useStockScorecardStore } from "./stockScorecardStore";

const api = stockScorecardService as unknown as { get: ReturnType<typeof vi.fn> };

function makeScorecard(): StockScorecardResponse {
  return {
    symbol: "AAPL",
    companyName: "Apple Inc.",
    technicalScore: 72,
    fundamentalScore: 64,
    newsScore: 55,
    sentimentScore: null,
    overallScore: 66,
    riskLevel: "MEDIUM",
    confidenceLevel: "MEDIUM",
    overallView: "INTERESTING_BUT_WAIT_FOR_PULLBACK",
    summary: "Resumen de prueba.",
    strengths: ["Fortaleza A"],
    risks: ["Riesgo B"],
    watchItems: ["Vigilar C"],
    dataAvailability: { technical: true, fundamentals: true, news: true, sentiment: false },
    lastUpdated: "2026-06-13T00:00:00Z",
    warnings: [],
  };
}

const CTX: ChatGptContext = { symbol: "AAPL" };
const OFF_TOGGLES: ChatGptContextToggles = {
  includePriceSummary: false,
  includeIndicators: false,
  includeDrawings: false,
  includeWatchlistNotes: false,
  includeFavoriteStatus: false,
  includeTimeframeSummary: false,
  includeScorecard: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  useStockScorecardStore.setState({
    bySymbol: {},
    loadingBySymbol: {},
    errorBySymbol: {},
    expandedBySymbol: {},
  });
});

describe("stockScorecardStore", () => {
  it("load guarda el scorecard por símbolo", async () => {
    api.get.mockResolvedValue(makeScorecard());
    await useStockScorecardStore.getState().load("aapl");
    expect(api.get).toHaveBeenCalledWith("AAPL", { forceRefresh: false });
    expect(useStockScorecardStore.getState().bySymbol.AAPL.overallScore).toBe(66);
  });

  it("load con error guarda el mensaje y no rompe", async () => {
    api.get.mockRejectedValue(new Error("boom"));
    await useStockScorecardStore.getState().load("AAPL");
    expect(useStockScorecardStore.getState().errorBySymbol.AAPL).toBe("boom");
    expect(useStockScorecardStore.getState().bySymbol.AAPL).toBeUndefined();
  });

  it("toggleExpanded alterna el detalle por símbolo", () => {
    useStockScorecardStore.getState().toggleExpanded("AAPL");
    expect(useStockScorecardStore.getState().expandedBySymbol.AAPL).toBe(true);
    useStockScorecardStore.getState().toggleExpanded("AAPL");
    expect(useStockScorecardStore.getState().expandedBySymbol.AAPL).toBe(false);
  });
});

describe("buildScorecardExplainMessage", () => {
  it("incluye símbolo, scores y la petición de no ser consejo financiero", () => {
    const msg = buildScorecardExplainMessage(makeScorecard());
    expect(msg).toContain("Stock Scorecard de AAPL");
    expect(msg.toLowerCase()).toContain("no lo presentes como consejo");
    expect(msg.toLowerCase()).toContain("fortaleza a");
  });
});

describe("ChatGPT prompt incluye el scorecard según el toggle", () => {
  it("incluye la sección Stock Scorecard cuando el toggle está activo", () => {
    const prompt = buildChatGptPrompt(
      "technical_analysis",
      CTX,
      OFF_TOGGLES,
      null,
      null,
      null,
      makeScorecard()
    );
    expect(prompt).toContain("Stock Scorecard");
    expect(prompt).toContain(OVERALL_VIEW_LABEL["INTERESTING_BUT_WAIT_FOR_PULLBACK"]);
  });

  it("omite el scorecard cuando el toggle está apagado", () => {
    const prompt = buildChatGptPrompt(
      "technical_analysis",
      CTX,
      { ...OFF_TOGGLES, includeScorecard: false },
      null,
      null,
      null,
      makeScorecard()
    );
    expect(prompt).not.toContain("Stock Scorecard");
  });
});
