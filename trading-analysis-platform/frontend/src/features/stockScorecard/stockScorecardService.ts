// Servicio HTTP del Stock Scorecard. Todo pasa por apiClient (Bearer + 401).
import { apiClient } from "@/services/apiClient";
import type { StockScorecardResponse } from "./stockScorecardTypes";

export interface ScorecardQuery {
  forceRefresh?: boolean;
  workspaceId?: number | null;
  focusedChartSlotId?: string | null;
}

export const stockScorecardService = {
  get(symbol: string, opts: ScorecardQuery = {}): Promise<StockScorecardResponse> {
    const q = new URLSearchParams();
    if (opts.forceRefresh) q.set("forceRefresh", "true");
    if (opts.workspaceId != null) q.set("workspaceId", String(opts.workspaceId));
    if (opts.focusedChartSlotId) q.set("focusedChartSlotId", opts.focusedChartSlotId);
    const qs = q.toString();
    return apiClient.get<StockScorecardResponse>(
      `/stocks/${encodeURIComponent(symbol)}/scorecard${qs ? `?${qs}` : ""}`
    );
  },
};
