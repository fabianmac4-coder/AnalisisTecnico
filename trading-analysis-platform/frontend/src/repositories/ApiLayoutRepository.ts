// Layout default por usuario en SQL via API (dbo.C030).

import { ApiError, apiClient } from "@/services/apiClient";
import type { ChartLayout, LayoutRepository } from "./LayoutRepository";

export class ApiLayoutRepository implements LayoutRepository {
  async getDefault(): Promise<ChartLayout | null> {
    try {
      return await apiClient.get<ChartLayout>("/layouts/default");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  async saveDefault(layout: ChartLayout): Promise<void> {
    await apiClient.put("/layouts/default", { ...layout, isDefault: true });
  }
}
