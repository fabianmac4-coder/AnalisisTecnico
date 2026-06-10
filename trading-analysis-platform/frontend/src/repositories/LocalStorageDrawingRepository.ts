import type { Drawing } from "@/features/drawings/drawingTypes";
import { migrateDrawing } from "@/features/drawings/drawingMigration";
import { safeParseJson } from "@/utils/safeParseJson";
import type { DrawingRepository } from "./DrawingRepository";

const STORAGE_KEY = "tap.drawings.v1";

/**
 * Persistencia de dibujos en localStorage, indexados por simbolo.
 * Estructura: { [symbol]: Drawing[] }. Aplica migracion al leer; un JSON
 * corrupto o un dibujo individual invalido nunca tiran la app.
 */
export class LocalStorageDrawingRepository implements DrawingRepository {
  private read(): Record<string, Drawing[]> {
    const parsed = safeParseJson<Record<string, unknown[]>>(
      localStorage.getItem(STORAGE_KEY),
      {}
    );
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, Drawing[]> = {};
    for (const symbol of Object.keys(parsed)) {
      const list = Array.isArray(parsed[symbol]) ? parsed[symbol] : [];
      out[symbol] = list.flatMap((d) => {
        try {
          return [migrateDrawing(d)];
        } catch (error) {
          console.warn("Dibujo persistido invalido, se omite", error);
          return [];
        }
      });
    }
    return out;
  }

  private write(data: Record<string, Drawing[]>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async listBySymbol(symbol: string): Promise<Drawing[]> {
    const data = this.read();
    return data[symbol] ?? [];
  }

  async upsert(drawing: Drawing): Promise<Drawing> {
    const data = this.read();
    const list = data[drawing.symbol] ?? [];
    const idx = list.findIndex((d) => d.id === drawing.id);
    const updated: Drawing = { ...drawing, updatedAt: new Date().toISOString() };
    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.push(updated);
    }
    data[drawing.symbol] = list;
    this.write(data);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const data = this.read();
    for (const symbol of Object.keys(data)) {
      data[symbol] = data[symbol].filter((d) => d.id !== id);
    }
    this.write(data);
  }
}
