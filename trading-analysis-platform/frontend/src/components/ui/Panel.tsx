import type { ReactNode } from "react";

/** Tarjeta/panel oscuro reutilizable. */
export function Panel({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-lg border border-edge bg-panel ${className}`}>{children}</div>
  );
}
