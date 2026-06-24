// Servicio HTTP de preferencias de usuario (dbo.C092 via backend).
// Por ahora SOLO la "plantilla por defecto" de las seis graficas, que se aplica
// a stocks/workspaces nuevos. Todo pasa por apiClient (Bearer + manejo de 401).

import { apiClient } from "@/services/apiClient";
import {
  normalizeChartSlots,
  type ChartSlotConfig,
} from "./chartWorkspaceTypes";

const TEMPLATE_PATH = "/user-preferences/default-chart-layout-template";

/** Origen de la plantilla efectiva. */
export type ChartTemplateSource = "USER" | "SYSTEM";

interface ChartLayoutTemplateDto {
  source?: ChartTemplateSource;
  chartSlots: ChartSlotConfig[];
  isUserTemplate?: boolean;
}

export interface ChartLayoutTemplate {
  /** "USER" = plantilla guardada por el usuario; "SYSTEM" = default del sistema. */
  source: ChartTemplateSource;
  /** Seis slots saneados de la plantilla efectiva (usuario o sistema). */
  chartSlots: ChartSlotConfig[];
  /** True si el usuario guardó su propia plantilla; false = default del sistema. */
  isUserTemplate: boolean;
}

function fromDto(dto: ChartLayoutTemplateDto): ChartLayoutTemplate {
  // `source` es la fuente de verdad; si un backend viejo no la envía, se deriva
  // de isUserTemplate (compatibilidad hacia atrás).
  const isUser = dto.source ? dto.source === "USER" : !!dto.isUserTemplate;
  return {
    source: isUser ? "USER" : "SYSTEM",
    chartSlots: normalizeChartSlots(dto.chartSlots),
    isUserTemplate: isUser,
  };
}

export const userPreferencesApi = {
  /** Plantilla efectiva del usuario (su plantilla guardada o el default). */
  async getTemplate(): Promise<ChartLayoutTemplate> {
    const dto = await apiClient.get<ChartLayoutTemplateDto>(TEMPLATE_PATH);
    return fromDto(dto);
  },

  /** Guarda los seis slots como plantilla por defecto del usuario. */
  async saveTemplate(
    chartSlots: ChartSlotConfig[]
  ): Promise<ChartLayoutTemplate> {
    // Solo envia los campos canonicos (slotId/range/interval) saneados.
    const slots = normalizeChartSlots(chartSlots).map((s) => ({
      slotId: s.slotId,
      range: s.range,
      interval: s.interval,
    }));
    const dto = await apiClient.post<ChartLayoutTemplateDto>(TEMPLATE_PATH, {
      chartSlots: slots,
    });
    return fromDto(dto);
  },

  /** Restablece la plantilla del sistema (borra la del usuario). */
  async resetTemplate(): Promise<ChartLayoutTemplate> {
    const dto = await apiClient.delete<ChartLayoutTemplateDto>(TEMPLATE_PATH);
    return fromDto(dto);
  },
};
