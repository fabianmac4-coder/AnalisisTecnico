import { describe, it, expect } from "vitest";
import { buildChatGptPrompt } from "./chatGptPromptService";
import type { ChatGptContext, ChatGptContextToggles } from "./chatGptIframeTypes";

const baseToggles: ChatGptContextToggles = {
  includePriceSummary: false,
  includeIndicators: false,
  includeDrawings: false,
  includePositionPlans: true,
  includeWatchlistNotes: false,
  includeFavoriteStatus: false,
  includeTimeframeSummary: false,
  includeScorecard: false,
  includeScorecardMetrics: false,
  includeMarketIntelligence: false,
  includeMacro: false,
  includePortfolio: false,
};

const ctx: ChatGptContext = {
  symbol: "AAPL",
  positionPlans: [
    {
      type: "LONG_POSITION",
      sourceTimeframe: "1Y_1D",
      entryPrice: 185.25,
      targetPrice: 210,
      stopPrice: 176,
      quantity: 10,
      riskRewardRatio: 2.68,
      riskPercent: 4.99,
      rewardPercent: 13.36,
      riskAmount: 92.5,
      rewardAmount: 247.5,
      notes: "Breakout retest",
    },
  ],
};

describe("buildChatGptPrompt — planes de posición", () => {
  it("incluye la caja Long con entrada/objetivo/stop y R/R", () => {
    const out = buildChatGptPrompt("technical_analysis", ctx, baseToggles);
    expect(out).toMatch(/planes de posición/i);
    expect(out).toContain("Long");
    expect(out).toContain("185.25");
    expect(out).toContain("210.00");
    expect(out).toContain("176.00");
    expect(out).toContain("2.68 : 1");
    expect(out).toContain("Breakout retest");
  });

  it("se omite cuando el toggle includePositionPlans es false", () => {
    const out = buildChatGptPrompt("technical_analysis", ctx, {
      ...baseToggles,
      includePositionPlans: false,
    });
    expect(out).not.toMatch(/planes de posición/i);
  });

  it("no rompe cuando no hay planes de posición", () => {
    const out = buildChatGptPrompt("technical_analysis", { symbol: "AAPL" }, baseToggles);
    expect(out).not.toMatch(/planes de posición/i);
    expect(out).toContain("AAPL");
  });
});
