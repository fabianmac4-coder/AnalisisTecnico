// Estado del modal de edición de cajas de posición (Long/Short). Guarda solo el
// id del dibujo en edición; el modal lee/escribe vía drawingStore.
import { create } from "zustand";

interface PositionBoxState {
  editingId: string | null;
  openEdit: (id: string) => void;
  closeEdit: () => void;
}

export const usePositionBoxStore = create<PositionBoxState>((set) => ({
  editingId: null,
  openEdit: (id) => set({ editingId: id }),
  closeEdit: () => set({ editingId: null }),
}));
