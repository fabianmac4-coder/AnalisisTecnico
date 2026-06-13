// Toasts ligeros globales (zustand). Sin dependencias externas; auto-descartan.
import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, type?: ToastType) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show(message, type = "info") {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, message, type }] });
    if (typeof window !== "undefined") {
      window.setTimeout(() => get().dismiss(id), 3000);
    }
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

/** Helper para disparar un toast desde cualquier parte (stores, handlers). */
export function showToast(message: string, type?: ToastType): void {
  useToastStore.getState().show(message, type);
}
