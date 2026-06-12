// Estado del panel ChatGPT (iframe/helper). No usa OpenAI ni guarda en SQL.

import { create } from "zustand";
import { useChannelRiskRewardStore } from "@/features/channelRiskReward/channelRiskRewardStore";
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
    },
    channelRR,
    channelTimeframe
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
