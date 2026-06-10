import { safeParseJson } from "@/utils/safeParseJson";
import type { ChartLayout, LayoutRepository } from "./LayoutRepository";

const STORAGE_KEY = "tap.layout.v1";

export class LocalStorageLayoutRepository implements LayoutRepository {
  async getDefault(): Promise<ChartLayout | null> {
    return safeParseJson<ChartLayout | null>(localStorage.getItem(STORAGE_KEY), null);
  }

  async saveDefault(layout: ChartLayout): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...layout, isDefault: true }));
  }
}
