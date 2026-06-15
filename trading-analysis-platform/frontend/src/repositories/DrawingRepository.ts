import type { Drawing } from "@/features/drawings/drawingTypes";

// Interfaz de persistencia de dibujos. Los componentes/stores dependen de esta
// abstraccion, nunca de localStorage directamente. Manana puede existir una
// implementacion que use la API del backend / base de datos.
export interface DrawingRepository {
  /** Lista los dibujos del símbolo; si se pasa `c030Id`, solo los de ese
   *  workspace de análisis (aislamiento por workspace). */
  listBySymbol(symbol: string, c030Id?: number): Promise<Drawing[]>;
  upsert(drawing: Drawing): Promise<Drawing>;
  remove(id: string): Promise<void>;
}
