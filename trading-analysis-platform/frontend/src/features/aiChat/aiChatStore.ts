// Estado global del chat de IA (zustand). Acotado al ticker activo.

import { create } from "zustand";
import { aiChatService } from "./aiChatService";
import type { AiConversation, AiMessage } from "./aiChatTypes";

/**
 * Construye el contexto del workspace de analisis ACTIVO para la IA: nombre,
 * c030Id y los seis slots (range/interval + contextKey). Solo el workspace
 * activo (nunca los inactivos). Devuelve undefined si no hay ninguno.
 */
async function buildActiveWorkspaceContext(): Promise<
  Record<string, unknown> | undefined
> {
  try {
    const { useChartStore } = await import("@/stores/chartStore");
    const { useChartWorkspaceStore, selectActiveWorkspace } = await import(
      "@/features/charts/chartWorkspaceStore"
    );
    const { slotContextKey } = await import(
      "@/features/charts/chartWorkspaceTypes"
    );
    const symbol = useChartStore.getState().activeSymbol;
    const ws = selectActiveWorkspace(useChartWorkspaceStore.getState(), symbol);
    if (!ws) return undefined;
    return {
      c030Id: ws.c030Id,
      name: ws.name,
      symbol: ws.symbol,
      chartContext: ws.chartSlots.map((s) => ({
        slotId: s.slotId,
        range: s.range,
        interval: s.interval,
        contextKey: slotContextKey(s),
      })),
    };
  } catch {
    return undefined; // el contexto del workspace nunca debe romper el envio
  }
}

interface AiChatState {
  isOpen: boolean;
  /** Simbolo al que esta acotado el panel (ticker activo al abrirlo). */
  activeSymbol: string | null;
  activeConversationId: number | null;
  conversationsBySymbol: Record<string, AiConversation[]>;
  messagesByConversation: Record<number, AiMessage[]>;
  loading: boolean;
  sending: boolean;
  error: string | null;
  /** Texto a precargar en el input (p.ej. desde el Stock Scorecard). */
  prefillMessage: string | null;

  // Toggles de contexto (por defecto todo activado).
  includeChartContext: boolean;
  includeDrawings: boolean;
  includeIndicators: boolean;
  includeNews: boolean;

  openChat: (symbol: string) => Promise<void>;
  /** Abre el chat del símbolo y precarga un mensaje en el input. */
  openWithPrefill: (symbol: string, message: string) => Promise<void>;
  consumePrefill: () => void;
  closeChat: () => void;
  setSymbol: (symbol: string) => Promise<void>;
  loadConversations: (symbol: string) => Promise<void>;
  createConversation: (symbol: string) => Promise<void>;
  selectConversation: (conversationId: number) => Promise<void>;
  loadMessages: (conversationId: number) => Promise<void>;
  sendMessage: (conversationId: number, message: string) => Promise<void>;
  renameConversation: (conversationId: number, title: string) => Promise<void>;
  deleteConversation: (conversationId: number) => Promise<void>;
  setToggle: (
    key: "includeChartContext" | "includeDrawings" | "includeIndicators" | "includeNews",
    value: boolean
  ) => void;
}

export const useAiChatStore = create<AiChatState>((set, get) => ({
  isOpen: false,
  activeSymbol: null,
  activeConversationId: null,
  conversationsBySymbol: {},
  messagesByConversation: {},
  loading: false,
  sending: false,
  error: null,
  prefillMessage: null,

  includeChartContext: true,
  includeDrawings: true,
  includeIndicators: true,
  includeNews: true,

  async openChat(symbol) {
    set({ isOpen: true, error: null });
    await get().setSymbol(symbol);
  },

  async openWithPrefill(symbol, message) {
    set({ isOpen: true, error: null, prefillMessage: message });
    await get().setSymbol(symbol);
  },

  consumePrefill() {
    set({ prefillMessage: null });
  },

  closeChat() {
    set({ isOpen: false });
  },

  async setSymbol(symbol) {
    set({ activeSymbol: symbol, activeConversationId: null, error: null });
    await get().loadConversations(symbol);
    // Reabre la conversacion mas reciente del simbolo, si existe.
    const convs = get().conversationsBySymbol[symbol] ?? [];
    if (convs.length > 0) {
      await get().selectConversation(convs[0].id);
    }
  },

  async loadConversations(symbol) {
    set({ loading: true, error: null });
    try {
      const convs = await aiChatService.listConversations(symbol);
      set((state) => ({
        conversationsBySymbol: { ...state.conversationsBySymbol, [symbol]: convs },
        loading: false,
      }));
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  async createConversation(symbol) {
    set({ loading: true, error: null });
    try {
      const conv = await aiChatService.createConversation(symbol);
      set((state) => ({
        conversationsBySymbol: {
          ...state.conversationsBySymbol,
          [symbol]: [conv, ...(state.conversationsBySymbol[symbol] ?? [])],
        },
        messagesByConversation: { ...state.messagesByConversation, [conv.id]: [] },
        activeConversationId: conv.id,
        loading: false,
      }));
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  async selectConversation(conversationId) {
    set({ activeConversationId: conversationId, error: null });
    await get().loadMessages(conversationId);
  },

  async loadMessages(conversationId) {
    set({ loading: true, error: null });
    try {
      const messages = await aiChatService.getMessages(conversationId);
      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: messages,
        },
        loading: false,
      }));
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  async sendMessage(conversationId, message) {
    const state = get();
    set({ sending: true, error: null });
    try {
      // R/R de canal (si el usuario lo calculo en el panel) viaja como
      // contexto adicional HIPOTETICO para el modelo.
      const { useChannelRiskRewardStore } = await import(
        "@/features/channelRiskReward/channelRiskRewardStore"
      );
      const { channelResultForAi } = await import(
        "@/features/channelRiskReward/channelRiskRewardService"
      );
      const channelState = useChannelRiskRewardStore.getState();
      const channelResult = channelState.result;
      const confidence = channelState.manualOverride
        ? null
        : channelState.autoBest?.confidence ?? null;
      // El canal auto es POR TEMPORALIDAD: viaja solo el de la grafica activa.
      const channelTimeframe = channelState.manualOverride
        ? null
        : channelState.autoBest?.timeframe ?? null;

      // Workspace de analisis activo: nombre + los seis slots (range/interval).
      const workspace = await buildActiveWorkspaceContext();

      // Inteligencia de mercado (si el usuario abrio esa pagina y se cargo):
      // viaja un resumen compacto del entorno (sentimiento + indices + movers).
      const { useMarketIntelligenceStore } = await import(
        "@/features/marketIntelligence/marketIntelligenceStore"
      );
      const overview = useMarketIntelligenceStore.getState().overview;
      const marketIntelligence = overview
        ? {
            sentiment: {
              score: overview.sentiment.score,
              label: overview.sentiment.label,
              confidence: overview.sentiment.confidence,
            },
            indices: overview.indices.map((i) => ({
              symbol: i.symbol,
              changePercent: i.changePercent,
              trend: i.trend,
            })),
            movers: {
              topGainer: overview.marketMoversSummary.topGainers[0]?.symbol ?? null,
              topLoser: overview.marketMoversSummary.topLosers[0]?.symbol ?? null,
            },
            topNews: overview.topNews.slice(0, 3).map((n) => n.title),
            whatThisMeans: overview.whatThisMeans.slice(0, 3),
          }
        : undefined;

      // Macro Dashboard (si el usuario abrió esa página y se cargó): contexto
      // compacto del entorno macro (riesgo + tasas + inflación + curva).
      const { useMacroStore } = await import("@/features/macro/macroStore");
      const macroOverview = useMacroStore.getState().overview;
      const macro = macroOverview
        ? {
            riskLevel: macroOverview.executiveSummary.riskLevel,
            riskLabel: macroOverview.executiveSummary.riskLabel,
            summary: macroOverview.executiveSummary.summary,
            curveStatus: macroOverview.rates.curveStatus,
            inflationTrend: macroOverview.usaIndicators.cpi?.trend ?? null,
            whatThisMeans: macroOverview.whatThisMeans.slice(0, 3),
          }
        : undefined;

      // Portafolio (si el usuario abrió esa página y se cargó el análisis):
      // resumen + concentración + posiciones top para preguntas de portafolio.
      const { usePortfolioStore } = await import("@/features/portfolio/portfolioStore");
      const pa = usePortfolioStore.getState().analysis;
      const portfolio = pa
        ? {
            name: pa.portfolio.name,
            summary: pa.summary,
            riskLevel: pa.risk.riskLevel,
            concentration: pa.risk.concentrationRisk,
            topPositions: [...pa.positions]
              .sort((a, b) => (b.portfolioWeight ?? 0) - (a.portfolioWeight ?? 0))
              .slice(0, 8)
              .map((p) => ({
                ticker: p.ticker,
                weight: p.portfolioWeight,
                gainLossPercent: p.gainLossPercent,
                sector: p.sector,
              })),
            recommendations: pa.recommendations.slice(0, 6),
          }
        : undefined;

      const res = await aiChatService.sendMessage(conversationId, {
        message,
        includeChartContext: state.includeChartContext,
        includeDrawings: state.includeDrawings,
        includeIndicators: state.includeIndicators,
        includeNews: state.includeNews,
        channelRiskReward: channelResult
          ? channelResultForAi(channelResult, confidence, channelTimeframe)
          : undefined,
        workspace,
        marketIntelligence,
        macro,
        portfolio,
      });
      set((prev) => ({
        messagesByConversation: {
          ...prev.messagesByConversation,
          [conversationId]: [
            ...(prev.messagesByConversation[conversationId] ?? []),
            res.userMessage,
            res.assistantMessage,
          ],
        },
        sending: false,
      }));
    } catch (err) {
      set({
        sending: false,
        error: (err as Error).message || "No se pudo enviar el mensaje",
      });
    }
  },

  async renameConversation(conversationId, title) {
    try {
      const updated = await aiChatService.renameConversation(conversationId, title);
      set((state) => {
        const symbol = get().activeSymbol;
        if (!symbol) return state;
        const convs = (state.conversationsBySymbol[symbol] ?? []).map((c) =>
          c.id === conversationId ? updated : c
        );
        return {
          conversationsBySymbol: { ...state.conversationsBySymbol, [symbol]: convs },
        };
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  async deleteConversation(conversationId) {
    try {
      await aiChatService.deleteConversation(conversationId);
      set((state) => {
        const symbol = get().activeSymbol;
        const convs = symbol
          ? (state.conversationsBySymbol[symbol] ?? []).filter(
              (c) => c.id !== conversationId
            )
          : [];
        return {
          conversationsBySymbol: symbol
            ? { ...state.conversationsBySymbol, [symbol]: convs }
            : state.conversationsBySymbol,
          activeConversationId:
            state.activeConversationId === conversationId
              ? null
              : state.activeConversationId,
        };
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setToggle(key, value) {
    set({ [key]: value } as Partial<AiChatState>);
  },
}));
