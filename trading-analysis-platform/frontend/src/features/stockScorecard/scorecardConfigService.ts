// Servicio HTTP de configuraciones de scorecard (dbo.C081 via backend).
import { apiClient } from "@/services/apiClient";
import type { ScorecardConfig, ScorecardConfigEntry } from "./scorecardConfigTypes";

export const scorecardConfigService = {
  getDefault(): Promise<ScorecardConfigEntry> {
    return apiClient.get<ScorecardConfigEntry>("/scorecard/configs/default");
  },
  list(): Promise<ScorecardConfigEntry[]> {
    return apiClient.get<ScorecardConfigEntry[]>("/scorecard/configs");
  },
  create(
    name: string,
    opts: { configuration?: ScorecardConfig; copyFromC081Id?: number } = {}
  ): Promise<ScorecardConfigEntry> {
    return apiClient.post<ScorecardConfigEntry>("/scorecard/configs", { name, ...opts });
  },
  update(
    c081Id: number,
    body: { name?: string; configuration?: ScorecardConfig }
  ): Promise<ScorecardConfigEntry> {
    return apiClient.patch<ScorecardConfigEntry>(`/scorecard/configs/${c081Id}`, body);
  },
  setDefault(c081Id: number): Promise<ScorecardConfigEntry> {
    return apiClient.patch<ScorecardConfigEntry>(
      `/scorecard/configs/${c081Id}/set-default`,
      {}
    );
  },
  /** Restaura la config DEFAULT del usuario a los valores del sistema. */
  resetDefault(): Promise<ScorecardConfigEntry> {
    return apiClient.post<ScorecardConfigEntry>("/scorecard/configs/reset-default", {});
  },
  remove(c081Id: number): Promise<void> {
    return apiClient.delete(`/scorecard/configs/${c081Id}`);
  },
};
