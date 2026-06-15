// Estado del panel ChatGPT (iframe/helper). No usa OpenAI ni guarda en SQL.

import { create } from "zustand";
import { useChannelRiskRewardStore } from "@/features/channelRiskReward/channelRiskRewardStore";
import {
  useChartWorkspaceStore,
  selectActiveWorkspace,
} from "@/features/charts/chartWorkspaceStore";
import {
  useStockScorecardStore,
  selectScorecard,
} from "@/features/stockScorecard/stockScorecardStore";
import { useMarketIntelligenceStore } from "@/features/marketIntelligence/marketIntelligenceStore";
import { useMacroStore } from "@/features/macro/macroStore";
import { usePortfolioStore } from "@/features/portfolio/portfolioStore";
import { buildChatGptPrompt, fetchChatGptContext } from "./chatGptPromptService";
import type {
  ChatGptContext,
  ChatGptContextToggles,
  ChatGptPromptType,
} from "./chatGptIframeTypes";

type ToggleKey = keyof ChatGptContextToggles;

interface ChatGptIframeState extends ChatGptContextToggles {
  isOpen: boolean;
  activeSymbol: string | null;
  activePromptType: ChatGptPromptType;
  context: ChatGptContext | null;
  generatedPrompt: string;
  loadingContext: boolean;
  error: string | null;
  notice: string | null;

  openPanel: (symbol: string) => Promise<void>;
  closePanel: () => void;
  setPromptType: (type: ChatGptPromptType) => void;
  toggleContextOption: (option: ToggleKey, value: boolean) => void;
  regeneratePrompt: (symbol: string) => Promise<void>;
  copyPrompt: () => Promise<boolean>;
  setNotice: (notice: string | null) => void;
}

function rebuild(state: ChatGptIframeState): string {
  if (!state.context) return "";
  // R/R de canal de la grafica ACTIVA (auto por temporalidad; manual si hay
  // override). Nunca se mandan los canales de todas las temporalidades.
  const channelState = useChannelRiskRewardStore.getState();
  const channelRR = channelState.result;
  const channelTimeframe = channelState.manualOverride
    ? null
    : channelState.autoBest?.timeframe ?? null;
  // Workspace de análisis activo (nombre + seis slots range/interval).
  const ws = selectActiveWorkspace(
    useChartWorkspaceStore.getState(),
    state.activeSymbol
  );
  const workspace = ws
    ? {
        name: ws.name,
        chartContext: ws.chartSlots.map((s) => ({
          slotId: s.slotId,
          range: s.range,
          interval: s.interval,
        })),
      }
    : null;
  // Stock Scorecard del símbolo activo (si ya se calculó y el toggle está on).
  const scorecard =
    state.includeScorecard && state.activeSymbol
      ? selectScorecard(
          useStockScorecardStore.getState(),
          state.activeSymbol
        ) ?? null
      : null;
  // Inteligencia de mercado (si el usuario abrió esa página y se cargó).
  const overview = state.includeMarketIntelligence
    ? useMarketIntelligenceStore.getState().overview
    : null;
  const marketIntelligence = overview
    ? {
        sentiment: {
          score: overview.sentiment.score,
          label: overview.sentiment.label,
          confidence: overview.sentiment.confidence,
        },
        vix: overview.indices.find((i) => i.symbol === "^VIX")?.price ?? null,
        indices: overview.indices
          .filter((i) => i.symbol !== "^VIX")
          .map((i) => ({
            symbol: i.symbol,
            changePercent: i.changePercent,
            trend: i.trend,
          })),
        topGainer: overview.marketMoversSummary.topGainers[0]?.symbol ?? null,
        topLoser: overview.marketMoversSummary.topLosers[0]?.symbol ?? null,
        topNews: overview.topNews.slice(0, 3).map((n) => n.title),
        whatThisMeans: overview.whatThisMeans,
      }
    : null;
  // Macro Dashboard (si el usuario abrió esa página y se cargó).
  const macroOverview = state.includeMacro
    ? useMacroStore.getState().overview
    : null;
  const macro = macroOverview
    ? {
        riskLevel: macroOverview.executiveSummary.riskLevel,
        riskLabel: macroOverview.executiveSummary.riskLabel,
        summary: macroOverview.executiveSummary.summary,
        curveStatus: macroOverview.rates.curveStatus,
        inflationTrend: macroOverview.usaIndicators.cpi?.trend ?? null,
        fedFundsDisplay: macroOverview.usaIndicators.fedFundsRate?.displayValue ?? null,
        treasury10YDisplay:
          (macroOverview.rates.treasury10Y as { displayValue?: string } | undefined)
            ?.displayValue ?? null,
        calendar: macroOverview.economicCalendar.slice(0, 3).map((e) => ({
          eventName: e.eventName,
          date: e.date,
          impact: e.impact,
        })),
        whatThisMeans: macroOverview.whatThisMeans,
      }
    : null;
  // Portafolio (si el toggle está activo y ya se cargó el análisis).
  const pa = state.includePortfolio ? usePortfolioStore.getState().analysis : null;
  const portfolio = pa
    ? {
        name: pa.portfolio.name,
        totalCost: pa.summary.totalCost,
        currentValue: pa.summary.currentValue,
        totalGainLossPercent: pa.summary.totalGainLossPercent,
        positionCount: pa.summary.positionCount,
        riskLevel: pa.risk.riskLevel,
        largestPosition: pa.risk.concentrationRisk.largestPositionTicker,
        largestPositionWeight: pa.risk.concentrationRisk.largestPositionWeight,
        top3Weight: pa.risk.concentrationRisk.top3Weight,
        benchmarkAlpha: pa.benchmark.available ? pa.benchmark.alphaEstimate ?? null : null,
        topPositions: [...pa.positions]
          .sort((a, b) => (b.portfolioWeight ?? 0) - (a.portfolioWeight ?? 0))
          .slice(0, 6)
          .map((p) => ({ ticker: p.ticker, weight: p.portfolioWeight, gainLossPercent: p.gainLossPercent })),
        recommendations: pa.recommendations.slice(0, 4).map((r) => r.message),
      }
    : null;
  return buildChatGptPrompt(
    state.activePromptType,
    state.context,
    {
      includePriceSummary: state.includePriceSummary,
      includeIndicators: state.includeIndicators,
      includeDrawings: state.includeDrawings,
      includeWatchlistNotes: state.includeWatchlistNotes,
      includeFavoriteStatus: state.includeFavoriteStatus,
      includeTimeframeSummary: state.includeTimeframeSummary,
      includeScorecard: state.includeScorecard,
      includeScorecardMetrics: state.includeScorecardMetrics,
      includeMarketIntelligence: state.includeMarketIntelligence,
      includeMacro: state.includeMacro,
      includePortfolio: state.includePortfolio,
    },
    channelRR,
    channelTimeframe,
    workspace,
    scorecard,
    marketIntelligence,
    macro,
    portfolio
  );
}

export const useChatGptIframeStore = create<ChatGptIframeState>((set, get) => ({
  isOpen: false,
  activeSymbol: null,
  activePromptType: "technical_analysis",
  context: null,
  generatedPrompt: "",
  loadingContext: false,
  error: null,
  notice: null,

  includePriceSummary: true,
  includeIndicators: true,
  includeDrawings: true,
  includeWatchlistNotes: true,
  includeFavoriteStatus: true,
  includeTimeframeSummary: true,
  includeScorecard: true,
  includeScorecardMetrics: false,
  includeMarketIntelligence: true,
  includeMacro: true,
  includePortfolio: true,

  async openPanel(symbol) {
    set({ isOpen: true, error: null, notice: null });
    await get().regeneratePrompt(symbol);
  },

  closePanel() {
    set({ isOpen: false });
  },

  setPromptType(type) {
    set({ activePromptType: type });
    set((state) => ({ generatedPrompt: rebuild(state as ChatGptIframeState) }));
  },

  toggleContextOption(option, value) {
    set({ [option]: value } as Partial<ChatGptIframeState>);
    set((state) => ({ generatedPrompt: rebuild(state as ChatGptIframeState) }));
  },

  async regeneratePrompt(symbol) {
    set({ loadingContext: true, error: null, activeSymbol: symbol });
    try {
      const context = await fetchChatGptContext(symbol);
      set({ context, loadingContext: false });
      set((state) => ({ generatedPrompt: rebuild(state as ChatGptIframeState) }));
    } catch (err) {
      set({
        loadingContext: false,
        error: (err as Error).message || "No se pudo cargar el contexto del ticker",
      });
    }
  },

  async copyPrompt() {
    const prompt = get().generatedPrompt;
    if (!prompt) return false;
    try {
      await navigator.clipboard.writeText(prompt);
      set({ notice: "Prompt copiado. Pégalo en ChatGPT." });
      return true;
    } catch {
      set({
        error:
          "No se pudo copiar automáticamente; selecciona el texto del prompt y cópialo manualmente.",
      });
      return false;
    }
  },

  setNotice(notice) {
    set({ notice });
  },
}));
