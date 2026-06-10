import type { Drawing } from "@/features/drawings/drawingTypes";

// Interfaz de persistencia de dibujos. Los componentes/stores dependen de esta
// abstraccion, nunca de localStorage directamente. Manana puede existir una
// implementacion que use la API del backend / base de datos.
export interface DrawingRepository {
  listBySymbol(symbol: string): Promise<Drawing[]>;
  upsert(drawing: Drawing): Promise<Drawing>;
  remove(id: string): Promise<void>;
}
