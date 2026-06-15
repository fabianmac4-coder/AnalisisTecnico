// Captura el CONTEXTO de análisis al crear una entrada simulada, para poder
// revisarlo meses después: scorecard, Channel R/R, workspace y temporalidad.
// Lee de los stores existentes (getState, sin hooks). Solo guarda lo disponible.
import { useStockScorecardStore } from "@/features/stockScorecard/stockScorecardStore";
import { useChannelRiskRewardStore } from "@/features/channelRiskReward/channelRiskRewardStore";
import {
  useChartWorkspaceStore,
  selectActiveWorkspace,
} from "@/features/charts/chartWorkspaceStore";

export interface CapturedSnapshot {
  c030Id?: number;
  sourceTimeframe: string | null;
  metadata: Record<string, unknown>;
  analysisSnapshot: Record<string, unknown>;
}

/** Construye metadata + analysisSnapshot del momento de la entrada. */
export function captureAnalysisSnapshot(symbol: string): CapturedSnapshot {
  const up = symbol.toUpperCase();
  const ws = selectActiveWorkspace(useChartWorkspaceStore.getState(), up);
  const channel = useChannelRiskRewardStore.getState();
  const sourceTimeframe = channel.autoBest?.timeframe ?? channel.activeChartPreset ?? null;
  const sc = useStockScorecardStore.getState().bySymbol[up];

  const analysisSnapshot: Record<string, unknown> = {
    createdFrom: "SIM_ENTRY_TOOL",
    symbol: up,
  };
  if (ws) {
    analysisSnapshot.workspace = { c030Id: ws.c030Id, name: ws.name };
  }
  if (sc) {
    analysisSnapshot.scorecard = {
      overallScore: sc.overallScore,
      technicalScore: sc.technicalScore,
      fundamentalScore: sc.fundamentalScore,
      newsScore: sc.newsScore,
      sentimentScore: sc.sentimentScore,
      overallView: sc.overallView,
      riskLevel: sc.riskLevel,
      confidenceLevel: sc.confidenceLevel,
      summary: sc.summary,
    };
    // Valores técnicos reales del breakdown (precio/SMA/RSI/MACD…).
    const techMetrics = sc.breakdown?.technical?.metrics ?? [];
    const technicalContext: Record<string, unknown> = {};
    for (const m of techMetrics) {
      if (m.status !== "MISSING") technicalContext[m.key] = m.value ?? m.displayValue;
    }
    if (Object.keys(technicalContext).length) {
      analysisSnapshot.technicalContext = technicalContext;
    }
  }
  if (channel.result && !channel.result.invalidReason) {
    analysisSnapshot.channelRiskReward = {
      ratio: channel.result.ratio,
      upperChannelPrice: channel.result.upperChannelPrice,
      lowerChannelPrice: channel.result.lowerChannelPrice,
      potentialRewardPercent: channel.result.potentialRewardPercent,
      potentialRiskPercent: channel.result.potentialRiskPercent,
    };
  }

  const metadata: Record<string, unknown> = {
    chartContextKey: sourceTimeframe,
    workspaceName: ws?.name,
    capturedAt: new Date().toISOString(),
  };

  return {
    c030Id: ws?.c030Id,
    sourceTimeframe,
    metadata,
    analysisSnapshot,
  };
}
