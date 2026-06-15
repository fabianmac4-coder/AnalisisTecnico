// Persistencia de dibujos en SQL via API (dbo.C0101). Reemplaza a
// localStorage como persistencia primaria; el aislamiento por usuario lo
// garantiza el backend con el token.

import type { Drawing } from "@/features/drawings/drawingTypes";
import { migrateDrawing } from "@/features/drawings/drawingMigration";
import { apiClient } from "@/services/apiClient";
import type { DrawingRepository } from "./DrawingRepository";

function isServerId(id: string): boolean {
  return /^\d+$/.test(id);
}

export class ApiDrawingRepository implements DrawingRepository {
  async listBySymbol(symbol: string, c030Id?: number): Promise<Drawing[]> {
    const q = new URLSearchParams({ symbol });
    if (c030Id != null) q.set("c030Id", String(c030Id));
    const rows = await apiClient.get<Drawing[]>(`/drawings?${q.toString()}`);
    // La migracion local sigue aplicando (unidades de tiempo, defaults...).
    return rows.map((d) => migrateDrawing(d));
  }

  async upsert(drawing: Drawing): Promise<Drawing> {
    if (isServerId(drawing.id)) {
      const saved = await apiClient.patch<Drawing>(`/drawings/${drawing.id}`, drawing);
      return migrateDrawing(saved);
    }
    // id local (uuid) => crear; el backend asigna el id definitivo.
    const saved = await apiClient.post<Drawing>("/drawings", drawing);
    return migrateDrawing(saved);
  }

  async remove(id: string): Promise<void> {
    if (!isServerId(id)) return; // nunca llego a guardarse
    await apiClient.delete(`/drawings/${id}`);
  }
}
