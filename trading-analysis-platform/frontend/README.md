# Frontend — Trading Analysis Platform

SPA en React + TypeScript + Vite. Renderiza las seis gráficas por temporalidad,
el sistema de dibujos, la vista resumen con confluencias y los indicadores.

## Requisitos

- Node.js 18+ y npm.
- El backend corriendo en `http://localhost:8000` (Vite proxyea `/api`).

## Instalación y ejecución

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (proxy a `/api`). |
| `npm run build` | Typecheck + build de producción. |
| `npm run typecheck` | Solo verificación de tipos. |
| `npm test` | Pruebas unitarias (Vitest). |

## Arquitectura (resumen)

- `services/` — `apiClient` (único punto de red) y `marketDataService`.
- `repositories/` — interfaces + implementaciones `localStorage`. Ningún
  componente toca `localStorage` directamente.
- `stores/` — estado global con Zustand (`chart`, `symbol`, `drawing`, `layout`).
- `features/charting/chartEngine/` — `ChartEngineAdapter` (interfaz) +
  `LightweightChartsAdapter` (implementación). Permite migrar de motor sin
  reescribir las features.
- `features/drawings/` — modelo, matemática, hit-testing y capa de render
  (canvas overlay). **Los dibujos se guardan en tiempo/precio reales, nunca en
  píxeles.**
- `features/indicators/` — cálculos puros (SMA, EMA, RSI, MACD, Bollinger).
- `features/confluences/` — agrupación de niveles (función pura + pruebas).
- `utils/timeframes.ts` — definición centralizada de las seis temporalidades
  (alineada con `backend/app/timeframes.py`).

## Variables de entorno

- `VITE_API_BASE` (opcional): base de la API. Por defecto `/api`.
