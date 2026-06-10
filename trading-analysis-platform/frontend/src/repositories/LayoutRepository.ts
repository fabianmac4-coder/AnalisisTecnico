import type { PresetKey } from "@/utils/timeframes";
import type { ChartType } from "@/features/charting/chartEngine/ChartEngineAdapter";

/** Layout persistible de la vista de graficas. */
export interface ChartLayout {
  id: string;
  name: string;
  isDefault: boolean;
  /** Tipo de grafica preferido por temporalidad. */
  chartTypeByPreset: Partial<Record<PresetKey, ChartType>>;
  theme: "dark" | "light";
}

export interface LayoutRepository {
  getDefault(): Promise<ChartLayout | null>;
  saveDefault(layout: ChartLayout): Promise<void>;
}
