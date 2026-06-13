// Barra de pestañas de workspaces de analisis del simbolo activo. Permite crear,
// cambiar, renombrar (inline), duplicar, marcar default y eliminar (con modal de
// confirmacion). La config de cada uno (seis slots) vive en C030; aqui se
// orquesta. El menu se renderiza en un PORTAL para que no lo recorte el scroll
// horizontal de la barra (causa del bug anterior de "no puedo renombrar/borrar").

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { showToast } from "@/components/ui/toastStore";
import {
  useChartWorkspaceStore,
  selectActiveWorkspace,
} from "./chartWorkspaceStore";

interface Props {
  symbol: string;
}

export function WorkspaceTabBar({ symbol }: Props) {
  const up = symbol.toUpperCase();
  const workspaces = useChartWorkspaceStore((s) => s.workspacesBySymbol[up]) ?? [];
  const activeId = useChartWorkspaceStore((s) => s.activeWorkspaceBySymbol[up]);
  const active = useChartWorkspaceStore((s) => selectActiveWorkspace(s, up));
  const setActiveWorkspace = useChartWorkspaceStore((s) => s.setActiveWorkspace);
  const createWorkspace = useChartWorkspaceStore((s) => s.createWorkspace);
  const renameWorkspace = useChartWorkspaceStore((s) => s.renameWorkspace);
  const duplicateWorkspace = useChartWorkspaceStore((s) => s.duplicateWorkspace);
  const deleteWorkspace = useChartWorkspaceStore((s) => s.deleteWorkspace);
  const setDefaultWorkspace = useChartWorkspaceStore((s) => s.setDefaultWorkspace);

  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(
    null
  );
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId != null) renameInputRef.current?.select();
  }, [renamingId]);

  const activeWorkspaceId = activeId ?? active?.c030Id;

  // Ejecuta una accion del store y muestra toast segun el resultado (el store
  // limpia `error` al inicio de cada accion y lo setea si falla).
  async function run(
    action: () => Promise<void>,
    successMsg: string,
    errorMsg: string
  ) {
    await action();
    if (useChartWorkspaceStore.getState().error) showToast(errorMsg, "error");
    else showToast(successMsg, "success");
  }

  function openMenu(e: React.MouseEvent, c030Id: number) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 2, left: Math.max(8, rect.right - 160) });
    setMenuFor(menuFor === c030Id ? null : c030Id);
  }

  function closeMenu() {
    setMenuFor(null);
    setMenuPos(null);
  }

  function handleNew() {
    const name = window.prompt("Nombre del nuevo análisis:", "Nuevo análisis");
    if (name && name.trim()) {
      void run(
        () => createWorkspace(up, name.trim()),
        "Análisis creado",
        "No se pudo crear el análisis"
      );
    }
  }

  function startRename(c030Id: number, current: string) {
    closeMenu();
    setRenamingId(c030Id);
    setRenameValue(current);
  }

  function commitRename(c030Id: number) {
    const name = renameValue.trim();
    setRenamingId(null);
    const current = workspaces.find((w) => w.c030Id === c030Id)?.name ?? "";
    if (!name) {
      showToast("El nombre no puede estar vacío", "error");
      return;
    }
    if (name === current) return;
    void run(
      () => renameWorkspace(up, c030Id, name),
      "Análisis renombrado",
      "No se pudo renombrar el análisis"
    );
  }

  function handleDuplicate(c030Id: number, current: string) {
    closeMenu();
    void run(
      () => duplicateWorkspace(up, c030Id, `${current} Copy`),
      "Análisis duplicado",
      "No se pudo duplicar el análisis"
    );
  }

  function handleSetDefault(c030Id: number) {
    closeMenu();
    void run(
      () => setDefaultWorkspace(up, c030Id),
      "Análisis por defecto actualizado",
      "No se pudo actualizar el predeterminado"
    );
  }

  function askDelete(c030Id: number, name: string) {
    closeMenu();
    if (workspaces.length <= 1) {
      showToast("Se requiere al menos un análisis de workspace.", "error");
      return;
    }
    setConfirmDelete({ id: c030Id, name });
  }

  function confirmDeleteNow() {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setConfirmDelete(null);
    void run(
      () => deleteWorkspace(up, id),
      "Análisis eliminado",
      "No se pudo eliminar el análisis"
    );
  }

  const menuWs = menuFor != null ? workspaces.find((w) => w.c030Id === menuFor) : null;

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto border-b border-edge bg-panel px-2 py-1"
      data-testid="workspace-tab-bar"
    >
      <span className="mr-1 shrink-0 text-xs font-bold text-gray-100">{up}</span>

      {workspaces.map((ws) => {
        const isActive = ws.c030Id === activeWorkspaceId;
        const isRenaming = renamingId === ws.c030Id;
        return (
          <div
            key={ws.c030Id}
            className={`flex shrink-0 items-center gap-0.5 rounded-t px-1 ${
              isActive ? "bg-panel-3" : "hover:bg-panel-3/60"
            }`}
            data-testid={`workspace-tab-${ws.c030Id}`}
          >
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => commitRename(ws.c030Id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(ws.c030Id);
                  if (e.key === "Escape") setRenamingId(null);
                }}
                maxLength={200}
                data-testid={`workspace-rename-input-${ws.c030Id}`}
                className="my-0.5 w-32 rounded bg-panel px-1 py-0.5 text-xs text-white outline outline-1 outline-accent"
              />
            ) : (
              <button
                onClick={() => setActiveWorkspace(up, ws.c030Id)}
                onDoubleClick={() => startRename(ws.c030Id, ws.name)}
                className={`flex items-center gap-1 py-1 text-xs ${
                  isActive ? "font-semibold text-white" : "text-muted"
                }`}
                title={ws.isDefault ? "Análisis por defecto" : "Doble clic para renombrar"}
              >
                {ws.isDefault && (
                  <span className="text-amber-400" data-testid={`workspace-default-${ws.c030Id}`}>
                    ★
                  </span>
                )}
                <span className="max-w-[140px] truncate">{ws.name}</span>
              </button>
            )}
            <button
              type="button"
              aria-label="Menú del análisis"
              data-testid={`workspace-menu-button-${ws.c030Id}`}
              onClick={(e) => openMenu(e, ws.c030Id)}
              className="rounded px-1 text-muted hover:text-white"
            >
              ⋯
            </button>
          </div>
        );
      })}

      <button
        data-testid="workspace-new"
        onClick={handleNew}
        className="shrink-0 rounded px-2 py-1 text-xs text-accent hover:bg-panel-3"
      >
        + Nuevo análisis
      </button>

      {/* Menu en portal: no lo recorta el overflow del scroll horizontal. */}
      {menuWs &&
        menuPos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={closeMenu}
              data-testid="workspace-menu-backdrop"
            />
            <div
              role="menu"
              data-testid="workspace-menu"
              style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
              className="z-50 w-40 rounded border border-edge bg-panel shadow-lg"
            >
              <MenuItem onClick={() => startRename(menuWs.c030Id, menuWs.name)}>
                Renombrar
              </MenuItem>
              <MenuItem onClick={() => handleDuplicate(menuWs.c030Id, menuWs.name)}>
                Duplicar
              </MenuItem>
              <MenuItem
                disabled={menuWs.isDefault}
                onClick={() => handleSetDefault(menuWs.c030Id)}
              >
                {menuWs.isDefault ? "Ya es predeterminado" : "Marcar por defecto"}
              </MenuItem>
              <MenuItem danger onClick={() => askDelete(menuWs.c030Id, menuWs.name)}>
                Eliminar
              </MenuItem>
            </div>
          </>,
          document.body
        )}

      {/* Modal de confirmacion de borrado. */}
      {confirmDelete &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-96 rounded-lg border border-edge bg-panel p-5" data-testid="workspace-delete-modal">
              <h2 className="mb-2 text-sm font-bold text-gray-100">
                ¿Eliminar análisis?
              </h2>
              <p className="mb-4 text-xs text-gray-300">
                Esto eliminará el análisis <strong>"{confirmDelete.name}"</strong>. Tus
                dibujos, indicadores, entradas simuladas, chats de IA, noticias,
                watchlist y datos de la acción <strong>no se borran</strong>.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  data-testid="workspace-delete-cancel"
                  className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteNow}
                  data-testid="workspace-delete-confirm"
                  className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                >
                  Eliminar análisis
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-panel-3 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent ${
        danger ? "text-down" : "text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
