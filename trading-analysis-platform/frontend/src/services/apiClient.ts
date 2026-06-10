// Cliente HTTP central hacia el backend. Ningun componente debe hacer fetch
// directo: todo pasa por aqui.

import type { Candle } from "@/features/charting/chartEngine/ChartEngineAdapter";
import type { SymbolInfo } from "@/features/symbols/symbolTypes";
import type { PresetKey } from "@/utils/timeframes";
import { getAuthToken, setAuthToken } from "@/features/auth/authToken";

// Vite proxyea /api al backend en dev (ver vite.config.ts).
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export interface OHLCVResponse {
  symbol: string;
  preset: PresetKey;
  interval: string;
  priceBasis?: string;
  currency?: string | null;
  timezone?: string | null;
  /** Velas visibles del preset (las que pinta la grafica). */
  bars: Candle[];
  /** Velas previas SOLO para indicadores (SMA 200...); nunca se pintan. */
  warmupBars?: Candle[];
  visibleFrom?: number | null;
  visibleTo?: number | null;
}

/** Cotizacion canonica: fuente unica del precio actual de un simbolo. */
export interface QuoteResponse {
  symbol: string;
  price: number;
  previousClose?: number | null;
  change?: number | null;
  changePercent?: number | null;
  currency?: string | null;
  marketState?: string | null;
  source: string;
  timestamp: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Rutas publicas: un 401 aqui NO debe desloguear (p.ej. login con password mala).
const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/validate-password-token",
  "/auth/set-password",
  "/auth/reset-password",
  "/auth/forgot-password",
];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    });
  } catch (err) {
    // Error de red (backend caido, sin conexion, etc.)
    throw new ApiError(`No se pudo conectar con el servidor: ${(err as Error).message}`, 0);
  }

  // Sesion invalida/expirada: limpiar estado y volver al login.
  if (res.status === 401 && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    setAuthToken(null);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* respuesta sin JSON */
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  healthCheck(): Promise<{ status: string; app: string }> {
    return request("/health");
  },

  // Verbos genericos para repositorios/servicios (con Bearer y manejo de 401).
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) });
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
  },
  delete<T = void>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },

  getOHLCV(
    symbol: string,
    preset: PresetKey,
    opts?: { includeWarmup?: boolean; warmupBars?: number }
  ): Promise<OHLCVResponse> {
    const q = new URLSearchParams({ symbol, preset });
    if (opts?.includeWarmup) {
      q.set("includeWarmup", "true");
      q.set("warmupBars", String(opts.warmupBars ?? 260));
    }
    return request<OHLCVResponse>(`/market/ohlcv?${q.toString()}`);
  },

  getQuote(symbol: string): Promise<QuoteResponse> {
    const q = new URLSearchParams({ symbol });
    return request<QuoteResponse>(`/market/quote?${q.toString()}`);
  },

  searchSymbols(query: string): Promise<{ query: string; results: SymbolInfo[] }> {
    const q = new URLSearchParams({ q: query });
    return request(`/symbols/search?${q.toString()}`);
  },
};
