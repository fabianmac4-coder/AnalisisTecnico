import { Component, type ErrorInfo, type ReactNode } from "react";

// Claves de almacenamiento PROPIAS de la app (no se toca nada mas del browser).
const APP_STORAGE_KEYS = ["tap.ui.v1", "tap.drawings.v1", "tap.catalog.v1", "tap.layout.v1"];

export function resetLocalAppState(): void {
  for (const key of APP_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage inaccesible: nada que limpiar */
    }
  }
}

interface BoundaryProps {
  children: ReactNode;
  /** "app" = pantalla completa con acciones; "panel" = tarjeta compacta. */
  variant: "app" | "panel";
  /** Etiqueta para el mensaje compacto (ej. el preset del panel). */
  label?: string;
}

interface BoundaryState {
  error: Error | null;
}

/**
 * Limite de error de React: un crash en un chart/indicador NO debe dejar la
 * app en blanco. A nivel app muestra una pantalla con "reintentar" y
 * "restablecer estado local"; a nivel panel, una tarjeta de error compacta y
 * el resto de la app sigue funcionando.
 */
export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.variant}]`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.variant === "panel") {
      return (
        <div className="flex h-full min-h-[80px] flex-col items-center justify-center gap-1 rounded-lg border border-edge bg-panel p-3 text-center">
          <span className="text-xs text-down">
            Error en {this.props.label ?? "este panel"}
          </span>
          <span className="max-w-full truncate text-[10px] text-muted">{error.message}</span>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-1 rounded bg-panel-3 px-2 py-0.5 text-[11px] text-gray-200 hover:bg-edge"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#0d1017] p-6 text-center">
        <span className="text-3xl">⚠️</span>
        <h1 className="text-lg font-semibold text-gray-100">La aplicación encontró un error</h1>
        <p className="max-w-md break-words text-sm text-muted">{error.message}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Recargar
          </button>
          <button
            onClick={() => {
              resetLocalAppState();
              window.location.reload();
            }}
            title="Borra solo el estado local de ESTA app (dibujos, watchlist, ajustes)"
            className="rounded border border-edge bg-panel-2 px-4 py-1.5 text-sm text-gray-200 hover:bg-panel-3"
          >
            Restablecer estado local
          </button>
        </div>
      </div>
    );
  }
}
