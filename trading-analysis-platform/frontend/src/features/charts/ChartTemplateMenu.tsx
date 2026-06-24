// Menú "Plantilla ▾": gestiona la PLANTILLA por defecto de las seis gráficas
// (preferencia de usuario C092). Distingue dos cosas que el usuario confundía:
//   - LA PLANTILLA (default para análisis NUEVOS): Guardar / Restablecer.
//   - ESTE ANÁLISIS (workspace activo): Aplicar plantilla a este análisis.
//
// Estado de la plantilla en `chartTemplateStore` (SQL es la fuente de verdad):
// Guardar/Restablecer actualizan el estado al instante, así "Restablecer" deja
// de "no hacer nada" visible y la cabecera muestra si la plantilla es tuya o del
// sistema. El menú y los modales se renderizan en PORTAL.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { showToast } from "@/components/ui/toastStore";
import { useChartStore } from "@/stores/chartStore";
import {
  useChartWorkspaceStore,
  selectActiveWorkspace,
} from "./chartWorkspaceStore";
import { useChartTemplateStore } from "./chartTemplateStore";

interface Props {
  symbol: string;
}

export function ChartTemplateMenu({ symbol }: Props) {
  const up = symbol.toUpperCase();
  const active = useChartWorkspaceStore((s) => selectActiveWorkspace(s, up));
  const applyChartSlots = useChartWorkspaceStore((s) => s.applyChartSlots);
  const loadWorkspaceSlots = useChartStore((s) => s.loadWorkspaceSlots);

  const template = useChartTemplateStore((s) => s.template);
  const loadTemplate = useChartTemplateStore((s) => s.load);
  const saveTemplate = useChartTemplateStore((s) => s.save);
  const resetTemplate = useChartTemplateStore((s) => s.reset);

  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Carga la plantilla efectiva una vez (no recarga si ya está en memoria).
  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  function toggle() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 260) });
    }
    setOpen((o) => !o);
  }

  function close() {
    setOpen(false);
    setMenuPos(null);
  }

  async function handleSave() {
    close();
    if (!active) {
      showToast("Abre un análisis para guardar la plantilla.", "error");
      return;
    }
    setBusy(true);
    try {
      const saved = await saveTemplate(active.chartSlots);
      if (!saved) {
        showToast("No se pudo guardar la plantilla.", "error");
        return;
      }
      // Aplica la plantilla recién guardada al workspace ACTIVO (persiste C030 +
      // recarga las seis gráficas). El usuario NO tiene que pulsar "Aplicar".
      const slots = await applyChartSlots(up, active.c030Id, saved.chartSlots);
      if (slots) await loadWorkspaceSlots(up, slots);
      showToast("Plantilla predeterminada guardada y aplicada.", "success");
    } finally {
      setBusy(false);
    }
  }

  function askApply() {
    close();
    if (!active) {
      showToast("Abre un análisis para aplicar la plantilla.", "error");
      return;
    }
    setConfirmApply(true);
  }

  async function doApply() {
    setConfirmApply(false);
    if (!active) return;
    setBusy(true);
    try {
      // Usa la plantilla en memoria; si no está cargada, la trae del backend.
      let tpl = useChartTemplateStore.getState().template;
      if (!tpl) {
        await loadTemplate({ force: true });
        tpl = useChartTemplateStore.getState().template;
      }
      if (!tpl) {
        showToast("No se pudo aplicar la plantilla.", "error");
        return;
      }
      const slots = await applyChartSlots(up, active.c030Id, tpl.chartSlots);
      if (slots) {
        // Recarga los datos de las seis gráficas con la nueva configuración.
        await loadWorkspaceSlots(up, slots);
        showToast("Plantilla aplicada a este análisis.", "success");
      } else {
        showToast("No se pudo aplicar la plantilla.", "error");
      }
    } finally {
      setBusy(false);
    }
  }

  function askReset() {
    close();
    setConfirmReset(true);
  }

  async function doReset() {
    setConfirmReset(false);
    setBusy(true);
    try {
      const sys = await resetTemplate();
      if (!sys) {
        showToast("No se pudo restablecer la plantilla.", "error");
        return;
      }
      // Aplica el default del SISTEMA al workspace activo (persiste C030 +
      // recarga): la pantalla actual cambia al instante al layout del sistema.
      if (active) {
        const slots = await applyChartSlots(up, active.c030Id, sys.chartSlots);
        if (slots) await loadWorkspaceSlots(up, slots);
      }
      showToast("Plantilla del sistema restablecida y aplicada.", "success");
    } finally {
      setBusy(false);
    }
  }

  const sourceLabel =
    template?.source === "USER"
      ? "Plantilla actual: tuya"
      : template
        ? "Plantilla actual: del sistema"
        : "Plantilla actual: —";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={busy}
        data-testid="chart-template-button"
        title="Plantilla por defecto de las seis gráficas (para análisis nuevos)"
        className="rounded bg-panel-3 px-2 py-0.5 text-[11px] text-gray-200 hover:bg-edge disabled:opacity-50"
      >
        Plantilla ▾
      </button>

      {open &&
        menuPos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={close}
              data-testid="chart-template-backdrop"
            />
            <div
              role="menu"
              data-testid="chart-template-menu"
              style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
              className="z-50 w-64 rounded border border-edge bg-panel shadow-lg"
            >
              <div
                data-testid="chart-template-source"
                className="border-b border-edge px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted"
              >
                {sourceLabel}
              </div>
              <div className="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold text-muted">
                Plantilla por defecto (análisis nuevos)
              </div>
              <TemplateMenuItem
                onClick={handleSave}
                data-testid="chart-template-save"
              >
                Guardar como plantilla predeterminada
              </TemplateMenuItem>
              <TemplateMenuItem
                onClick={askReset}
                data-testid="chart-template-reset"
              >
                Restablecer plantilla del sistema
              </TemplateMenuItem>
              <div className="mt-1 border-t border-edge px-3 pb-0.5 pt-1.5 text-[10px] font-semibold text-muted">
                Este análisis (workspace activo)
              </div>
              <TemplateMenuItem
                onClick={askApply}
                data-testid="chart-template-apply"
              >
                Aplicar plantilla a este análisis
              </TemplateMenuItem>
            </div>
          </>,
          document.body
        )}

      {confirmApply &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div
              className="w-96 rounded-lg border border-edge bg-panel p-5"
              data-testid="chart-template-apply-modal"
            >
              <h2 className="mb-2 text-sm font-bold text-gray-100">
                ¿Aplicar plantilla a este análisis?
              </h2>
              <p className="mb-4 text-xs text-gray-300">
                Esto cambiará las seis gráficas de este análisis. Los dibujos se
                mantendrán.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmApply(false)}
                  data-testid="chart-template-apply-cancel"
                  className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3"
                >
                  Cancelar
                </button>
                <button
                  onClick={doApply}
                  data-testid="chart-template-apply-confirm"
                  className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  Aplicar plantilla
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {confirmReset &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div
              className="w-96 rounded-lg border border-edge bg-panel p-5"
              data-testid="chart-template-reset-modal"
            >
              <h2 className="mb-2 text-sm font-bold text-gray-100">
                ¿Restablecer la plantilla del sistema?
              </h2>
              <p className="mb-4 text-xs text-gray-300">
                Se borrará tu plantilla guardada y este análisis volverá al
                layout del sistema. Los análisis nuevos también usarán el default
                del sistema. Los dibujos se mantienen.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  data-testid="chart-template-reset-cancel"
                  className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3"
                >
                  Cancelar
                </button>
                <button
                  onClick={doReset}
                  data-testid="chart-template-reset-confirm"
                  className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  Restablecer
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function TemplateMenuItem({
  children,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  "data-testid"?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-xs text-gray-200 hover:bg-panel-3"
      {...rest}
    >
      {children}
    </button>
  );
}
