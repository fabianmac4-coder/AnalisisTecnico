import type { PresetKey } from "@/utils/timeframes";
import type { ChartType } from "@/features/charting/chartEngine/ChartEngineAdapter";

/** Layout persistible de la vista de graficas. */
export interface ChartLayout {
  id: string;
  name: string;
  isDefault: boolean;
  /** Tipo de grafica preferido por temporalidad (legado). */
  chartTypeByPreset: Partial<Record<PresetKey, ChartType>>;
  /** Tipo de grafica preferido por slotId del workspace (modelo actual). */
  chartTypeBySlot?: Record<string, ChartType>;
  theme: "dark" | "light";
}

export interface LayoutRepository {
  getDefault(): Promise<ChartLayout | null>;
  saveDefault(layout: ChartLayout): Promise<void>;
}
