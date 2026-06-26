import { useEffect, useRef, useState } from "react";
import { AUTO_REFRESH_OPTIONS, autoRefreshOptionLabel } from "./refreshTypes";
import { useRefreshStore } from "./refreshStore";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/**
 * Menu de auto-refresh: checkboxes con comportamiento de radio (solo uno
 * activo; re-clic en el activo lo apaga; ninguno = Off). Minimo 5 min para
 * no saturar Yahoo Finance.
 */
export function AutoRefreshMenu() {
  const interval = useRefreshStore((s) => s.autoRefreshIntervalMinutes);
  const setInterval_ = useRefreshStore((s) => s.setAutoRefreshInterval);
  const lastRefreshedAt = useRefreshStore((s) => s.lastRefreshedAt);
  const notice = useRefreshStore((s) => s.notice);
  const error = useRefreshStore((s) => s.error);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Cierra el popover al hacer click fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="auto-refresh-button"
        title="Auto refresh de datos de mercado"
        className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-[11px] text-gray-200 hover:bg-panel-3"
      >
        ⏱ {interval == null ? "Auto: Off" : `Auto: ${interval} min`} ▾
      </button>

      {open && (
        <div
          data-testid="auto-refresh-menu"
          className="absolute right-0 top-8 z-50 w-48 rounded border border-edge bg-panel p-2 shadow-xl"
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Auto-recarga
          </p>
          <label
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[11px] text-gray-200 hover:bg-panel-2"
          >
            <input
              type="checkbox"
              checked={interval == null}
              onChange={() => setInterval_(null)}
              data-testid="auto-refresh-manual"
            />
            Manual
          </label>
          {AUTO_REFRESH_OPTIONS.map((minutes) => (
            <label
              key={minutes}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[11px] text-gray-200 hover:bg-panel-2"
            >
              <input
                type="checkbox"
                checked={interval === minutes}
                onChange={() => setInterval_(minutes)}
                data-testid={`auto-refresh-${minutes}`}
              />
              {autoRefreshOptionLabel(minutes)}
            </label>
          ))}
          <p className="mt-1.5 border-t border-edge pt-1.5 text-[10px] text-muted">
            {interval == null ? "Estado: Manual" : autoRefreshOptionLabel(interval)}
            {lastRefreshedAt && (
              <span data-testid="last-refresh">
                {" · Última: "}
                {formatTime(lastRefreshedAt)}
              </span>
            )}
          </p>
        </div>
      )}

      {(notice || error) && (
        <p
          data-testid="refresh-toast"
          className={`absolute right-0 top-8 z-40 whitespace-nowrap rounded border border-edge px-2 py-1 text-[10px] shadow-lg ${
            error ? "bg-red-500/10 text-down" : "bg-panel text-up"
          }`}
        >
          {error ?? notice}
        </p>
      )}
    </div>
  );
}
