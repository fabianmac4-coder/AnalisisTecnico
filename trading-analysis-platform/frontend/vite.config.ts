/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// El backend corre en :8000 por defecto. Proxyeamos /api para evitar CORS en dev.
// El destino del proxy es configurable con VITE_API_PROXY_TARGET (ej. si 8000
// esta ocupado, usar http://localhost:8001 en un .env.local).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8000";
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      // Puerto FIJO: la app vive siempre en http://localhost:5174. strictPort
      // evita que Vite "salte" a otro puerto y rompa marcadores/pestañas.
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      // Por defecto node; los tests que necesitan DOM declaran
      // `// @vitest-environment jsdom` en su cabecera.
      environment: "node",
      include: ["src/**/*.test.{ts,tsx}"],
    },
  };
});
