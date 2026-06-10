import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

/** Boton compacto e iconico para toolbars. */
export function IconButton({ active, className = "", children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={[
        "flex h-8 w-8 items-center justify-center rounded text-sm transition-colors",
        active ? "bg-accent text-white" : "text-muted hover:bg-panel-3 hover:text-gray-100",
        rest.disabled ? "opacity-40 cursor-not-allowed" : "",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
