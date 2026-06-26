// Portapapeles de dibujos + acciones Copiar/Pegar/Duplicar. Reutiliza el
// drawingStore (mismo create/select) y el helper PURO duplicateDrawing. Funciona
// igual en modo normal y maximizado. NO usa estado separado por panel.

import { useEffect } from "react";
import { create } from "zustand";
import type { Drawing } from "./drawingTypes";
import { duplicateDrawing } from "./drawingDuplication";
import { useDrawingStore } from "@/stores/drawingStore";
import { showToast } from "@/components/ui/toastStore";

interface ClipboardState {
  clipboard: Drawing | null;
  setClipboard: (d: Drawing | null) => void;
}

export const useDrawingClipboardStore = create<ClipboardState>((set) => ({
  clipboard: null,
  setClipboard: (clipboard) => set({ clipboard }),
}));

/** Dibujo actualmente seleccionado del símbolo (o null). */
export function getSelectedDrawing(symbol: string): Drawing | null {
  const st = useDrawingStore.getState();
  const list = st.drawingsBySymbol[symbol.toUpperCase()] ?? [];
  return list.find((d) => d.id === st.selectedDrawingId) ?? null;
}

/** Crea la copia (offset) vía el endpoint de creación y la deja seleccionada. */
export async function duplicateAndAddDrawing(d: Drawing): Promise<Drawing> {
  const saved = await useDrawingStore.getState().addDrawing(duplicateDrawing(d));
  useDrawingStore.getState().selectDrawing(saved.id);
  return saved;
}

/** Botón "Duplicar": duplica el seleccionado. Toast si no hay selección. */
export async function duplicateSelectedDrawing(symbol: string): Promise<void> {
  const sel = getSelectedDrawing(symbol);
  if (!sel) {
    showToast("Selecciona un dibujo para duplicarlo.", "error");
    return;
  }
  await duplicateAndAddDrawing(sel);
  showToast("Dibujo duplicado", "success");
}

function isTypingTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t || !t.tagName) return false;
  return (
    ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || !!t.isContentEditable
  );
}

/**
 * Atajos Ctrl/Cmd+C (copiar) y Ctrl/Cmd+V (pegar duplicado) del dibujo
 * seleccionado. Montar UNA vez (ChartGrid). No interfiere cuando el foco está en
 * un input/textarea/select ni cuando hay texto seleccionado (no secuestra la
 * copia de texto del navegador).
 */
export function useDrawingClipboardKeys(symbol: string | null): void {
  useEffect(() => {
    if (!symbol) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (isTypingTarget(e.target)) return;
      if (typeof window !== "undefined" && window.getSelection?.()?.toString()) {
        return; // hay texto seleccionado: dejar la copia nativa
      }
      const key = e.key.toLowerCase();
      if (key === "c") {
        const sel = getSelectedDrawing(symbol);
        if (sel) {
          useDrawingClipboardStore.getState().setClipboard(sel);
          showToast("Dibujo copiado", "success");
        }
      } else if (key === "v") {
        const clip = useDrawingClipboardStore.getState().clipboard;
        if (clip) {
          void duplicateAndAddDrawing(clip).then(() =>
            showToast("Dibujo pegado", "success")
          );
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [symbol]);
}
