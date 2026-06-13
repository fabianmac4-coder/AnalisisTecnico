// Servicio HTTP de workspaces de analisis (dbo.C030 via backend).
// Todo pasa por apiClient (Bearer + manejo de 401). C030 es la fuente de verdad
// de la configuracion guardada; solo el "workspace activo" vive en localStorage.

import { apiClient } from "@/services/apiClient";
import {
  normalizeChartSlots,
  type ChartSlotConfig,
  type ChartWorkspace,
} from "./chartWorkspaceTypes";

interface WorkspaceDto {
  c030Id: number;
  name: string;
  isDefault: boolean;
  symbol: string;
  c010Id: number;
  chartSlots: ChartSlotConfig[];
  configuration: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
}

function fromDto(dto: WorkspaceDto): ChartWorkspace {
  return {
    c030Id: dto.c030Id,
    name: dto.name,
    symbol: dto.symbol,
    c010Id: dto.c010Id,
    isDefault: dto.isDefault,
    chartSlots: normalizeChartSlots(dto.chartSlots),
    configuration: dto.configuration ?? {},
    createdAt: dto.createdAt ?? undefined,
    updatedAt: dto.updatedAt ?? undefined,
  };
}

export const chartWorkspaceApi = {
  async list(symbol: string): Promise<ChartWorkspace[]> {
    const dtos = await apiClient.get<WorkspaceDto[]>(
      `/layouts/stock/${encodeURIComponent(symbol)}`
    );
    return dtos.map(fromDto);
  },

  async create(
    symbol: string,
    name: string,
    copyFromC030Id?: number
  ): Promise<ChartWorkspace> {
    const dto = await apiClient.post<WorkspaceDto>(
      `/layouts/stock/${encodeURIComponent(symbol)}`,
      { name, copyFromC030Id }
    );
    return fromDto(dto);
  },

  async rename(c030Id: number, name: string): Promise<ChartWorkspace> {
    const dto = await apiClient.patch<WorkspaceDto>(`/layouts/${c030Id}`, { name });
    return fromDto(dto);
  },

  async updateChartSlots(
    c030Id: number,
    chartSlots: ChartSlotConfig[]
  ): Promise<ChartWorkspace> {
    const dto = await apiClient.patch<WorkspaceDto>(
      `/layouts/${c030Id}/chart-slots`,
      { chartSlots }
    );
    return fromDto(dto);
  },

  async setDefault(c030Id: number): Promise<ChartWorkspace> {
    const dto = await apiClient.patch<WorkspaceDto>(
      `/layouts/${c030Id}/set-default`,
      {}
    );
    return fromDto(dto);
  },

  async remove(c030Id: number): Promise<void> {
    await apiClient.delete(`/layouts/${c030Id}`);
  },
};
