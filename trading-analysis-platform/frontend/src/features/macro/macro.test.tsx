// @vitest-environment jsdom
// Tests del Macro Dashboard + integración del prompt ChatGPT.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MacroPage } from "./MacroPage";
import { useMacroStore } from "./macroStore";
import type { MacroIndicator, MacroOverviewResponse } from "./macroTypes";
import { buildChatGptPrompt } from "@/features/chatgptIframe/chatGptPromptService";
import type {
  ChatGptContext,
  ChatGptContextToggles,
} from "@/features/chatgptIframe/chatGptIframeTypes";

function ind(over: Partial<MacroIndicator> & { key: string; label: string }): MacroIndicator {
  return {
    value: 1, displayValue: "1", trend: "STABLE", status: "NEUTRAL",
    source: "Yahoo Finance", ...over,
  };
}

const OVERVIEW: MacroOverviewResponse = {
  executiveSummary: {
    riskLevel: "YELLOW", riskLabel: "Riesgo macro moderado",
    summary: "El entorno macro es mixto.", lastUpdated: "2026-06-15T12:00:00Z",
  },
  macroRisk: {
    riskLevel: "YELLOW", score: 58,
    drivers: ["Las tasas siguen restrictivas", "La curva está invertida"],
    risks: ["Acciones de valuación alta sensibles a tasas"],
  },
  usaIndicators: {
    cpi: ind({ key: "cpi", label: "Inflación CPI", value: 3.2, displayValue: "3.2%", trend: "IMPROVING", status: "POSITIVE" }),
    unemploymentRate: ind({ key: "unemploymentRate", label: "Desempleo", status: "MISSING", displayValue: "Unavailable" }),
    fedFundsRate: ind({ key: "fedFundsRate", label: "Tasa Fed", value: 5.25, displayValue: "5.25%", source: "FRED" }),
    industrialProduction: ind({ key: "industrialProduction", label: "Producción industrial", value: 103.42, displayValue: "103.42", status: "POSITIVE", trend: "IMPROVING", source: "FRED" }),
    retailSales: ind({ key: "retailSales", label: "Ventas minoristas", value: 720345, displayValue: "$720.3B", status: "POSITIVE", trend: "IMPROVING", source: "FRED", changePercent: 0.72 }),
  },
  rates: {
    treasury2Y: ind({ key: "treasury2Y", label: "Tesoro 2A", value: 4.8, displayValue: "4.80%" }),
    treasury10Y: ind({ key: "treasury10Y", label: "Tesoro 10A", value: 4.2, displayValue: "4.20%" }),
    yieldCurve10Y2Y: ind({ key: "yieldCurve10Y2Y", label: "Spread 10A-2A", value: -0.6, displayValue: "-0.60%", status: "NEGATIVE" }),
    curveStatus: "INVERTED",
  },
  globalMarkets: {
    fx: [ind({ key: "EURUSD=X", label: "EUR/USD", value: 1.08, displayValue: "1.0800", changePercent: 0.2 })],
    commodities: [ind({ key: "GC=F", label: "Oro", value: 2300, displayValue: "2,300.00", changePercent: -0.5 })],
    crypto: [ind({ key: "BTC-USD", label: "Bitcoin", value: 65000, displayValue: "65,000.00", changePercent: 1.5 })],
  },
  economicCalendar: [],
  economicCalendarAvailable: false,
  economicCalendarSource: "UNAVAILABLE",
  whatThisMeans: [
    "Si las tasas siguen altas, las valuaciones elevadas pueden ser más sensibles.",
    "Combina esta lectura macro con el Scorecard de cada acción.",
  ],
  dataAvailability: {
    macroProviderConfigured: false, ratesAvailable: true,
    globalMarketsAvailable: true, calendarAvailable: false,
  },
  warnings: ["FRED API key is not configured. Some macro indicators are unavailable."],
  lastUpdated: "2026-06-15T12:00:00Z",
  fromCache: false,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  useMacroStore.setState({ overview: null, loading: false, error: null });
});
afterEach(() => cleanup());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/macro"]}>
      <Routes>
        <Route path="/macro" element={<MacroPage />} />
        <Route path="/" element={<div>DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MacroPage", () => {
  it("renderiza el resumen ejecutivo con el badge de riesgo", () => {
    useMacroStore.setState({ overview: OVERVIEW });
    renderPage();
    expect(screen.getByText("Macro")).toBeTruthy();
    expect(screen.getByTestId("macro-executive-summary")).toBeTruthy();
    expect(screen.getAllByTestId("macro-risk-badge").length).toBeGreaterThan(0);
  });

  it("renderiza indicadores presentes y faltantes (MISSING)", () => {
    useMacroStore.setState({ overview: OVERVIEW });
    renderPage();
    expect(screen.getByTestId("macro-card-cpi")).toBeTruthy();
    expect(screen.getByText("3.2%")).toBeTruthy();
    // Desempleo MISSING -> "Unavailable".
    expect(screen.getByTestId("macro-card-unemploymentRate")).toBeTruthy();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  });

  it("renderiza el estado de la curva de rendimientos", () => {
    useMacroStore.setState({ overview: OVERVIEW });
    renderPage();
    expect(screen.getByTestId("rates-panel")).toBeTruthy();
    expect(screen.getByTestId("curve-status-badge").textContent).toContain("Invertida");
  });

  it("renderiza FX, materias primas y cripto", () => {
    useMacroStore.setState({ overview: OVERVIEW });
    renderPage();
    expect(screen.getByTestId("fx-group")).toBeTruthy();
    expect(screen.getByTestId("commodities-group")).toBeTruthy();
    expect(screen.getByTestId("crypto-group")).toBeTruthy();
    expect(screen.getByText("Bitcoin")).toBeTruthy();
  });

  it("NO muestra un panel de calendario vacío cuando no hay datos", () => {
    useMacroStore.setState({ overview: OVERVIEW });
    renderPage();
    // El calendario no está disponible -> el panel grande NO se renderiza.
    expect(screen.queryByTestId("economic-calendar-panel")).toBeNull();
    // Pero el aviso aparece en las advertencias de la página (vía warnings).
    expect(screen.getByTestId("macro-meaning-panel")).toBeTruthy();
  });

  it("muestra el calendario con eventos FRED cuando está disponible", () => {
    useMacroStore.setState({
      overview: {
        ...OVERVIEW,
        economicCalendarAvailable: true,
        economicCalendarSource: "FRED",
        economicCalendar: [
          { eventName: "CPI Inflation", date: "2026-07-14", impact: "HIGH", source: "FRED" },
          { eventName: "GDP", date: "2026-07-30", impact: "HIGH", source: "FRED" },
        ],
      },
    });
    renderPage();
    expect(screen.getByTestId("economic-calendar-panel")).toBeTruthy();
    expect(screen.getAllByTestId("calendar-event").length).toBe(2);
    expect(screen.getByText("CPI Inflation")).toBeTruthy();
  });

  it("cada tarjeta tiene un botón '?' que muestra la explicación al hacer click", () => {
    useMacroStore.setState({ overview: OVERVIEW });
    renderPage();
    // El icono "?" existe en las tarjetas (CPI, ISM, etc.).
    const cpiInfo = screen.getByTestId("macro-info-cpi");
    expect(cpiInfo).toBeTruthy();
    // Click (móvil/escritorio) muestra el popover con la interpretación.
    fireEvent.click(cpiInfo);
    const popover = screen.getByTestId("macro-info-popover-cpi");
    expect(popover.textContent).toContain("inflación de precios al consumidor");
    // Producción industrial muestra su explicación detallada con secciones.
    fireEvent.click(screen.getByTestId("macro-info-industrialProduction"));
    const ipPop = screen.getByTestId("macro-info-popover-industrialProduction");
    expect(ipPop.textContent).toMatch(/producción real/i);
    // Estructura enriquecida: cómo interpretarlo + lecturas + por qué importa.
    expect(ipPop.textContent).toMatch(/Cómo interpretarlo/i);
    expect(ipPop.textContent).toContain("Positiva:");
    expect(ipPop.textContent).toContain("Neutral:");
    expect(ipPop.textContent).toContain("Negativa:");
    expect(ipPop.textContent).toMatch(/Por qué importa/i);
  });

  it("muestra Producción industrial y Ventas minoristas, no las tarjetas ISM", () => {
    useMacroStore.setState({ overview: OVERVIEW });
    renderPage();
    expect(screen.getByTestId("macro-card-industrialProduction")).toBeTruthy();
    expect(screen.getByText("Producción industrial")).toBeTruthy();
    expect(screen.getByTestId("macro-card-retailSales")).toBeTruthy();
    expect(screen.getByText("$720.3B")).toBeTruthy();
    // Las tarjetas ISM ya no se renderizan.
    expect(screen.queryByTestId("macro-card-ismManufacturing")).toBeNull();
    expect(screen.queryByTestId("macro-card-ismServices")).toBeNull();
  });

  it("incluye USD/MXN en la sección de FX", () => {
    useMacroStore.setState({
      overview: {
        ...OVERVIEW,
        globalMarkets: {
          ...OVERVIEW.globalMarkets,
          fx: [
            ...OVERVIEW.globalMarkets.fx,
            ind({ key: "MXN=X", label: "USD/MXN", value: 18.5, displayValue: "18.5000", changePercent: 0.3, symbol: "MXN=X" }),
          ],
        },
      },
    });
    renderPage();
    expect(screen.getByText("USD/MXN")).toBeTruthy();
  });

  it("renderiza los bullets de 'Qué significa esto para inversionistas'", () => {
    useMacroStore.setState({ overview: OVERVIEW });
    renderPage();
    expect(screen.getByTestId("macro-meaning-panel")).toBeTruthy();
    expect(screen.getByText(/Combina esta lectura macro/)).toBeTruthy();
  });

  it("el botón actualizar usa forceRefresh=true", async () => {
    useMacroStore.setState({ overview: OVERVIEW });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(OVERVIEW) as never);
    renderPage();
    fireEvent.click(screen.getByTestId("macro-refresh"));
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((c) =>
        String(c[0]).includes("forceRefresh=true")
      );
      expect(call).toBeTruthy();
      expect(String(call![0])).toContain("/macro/overview");
    });
  });
});

describe("buildChatGptPrompt — sección Macro", () => {
  const ctx: ChatGptContext = { symbol: "AAPL" };
  const baseToggles: ChatGptContextToggles = {
    includePriceSummary: false,
    includeIndicators: false,
    includeDrawings: false,
    includeWatchlistNotes: false,
    includeFavoriteStatus: false,
    includeTimeframeSummary: false,
  };

  it("incluye el riesgo macro y la curva cuando el toggle está activo", () => {
    const prompt = buildChatGptPrompt(
      "macro_market_stock_decision",
      ctx,
      { ...baseToggles, includeMacro: true },
      null, null, null, null, null,
      {
        riskLevel: "YELLOW",
        riskLabel: "Riesgo macro moderado",
        summary: "Entorno mixto",
        curveStatus: "INVERTED",
        inflationTrend: "IMPROVING",
        whatThisMeans: ["Combina macro con el Scorecard"],
      }
    );
    expect(prompt).toContain("Contexto macro de hoy");
    expect(prompt).toContain("Riesgo macro moderado");
    expect(prompt).toContain("INVERTED");
  });

  it("no incluye la sección macro si el toggle está apagado", () => {
    const prompt = buildChatGptPrompt(
      "technical_analysis",
      ctx,
      { ...baseToggles, includeMacro: false },
      null, null, null, null, null,
      { riskLevel: "RED", riskLabel: "Riesgo macro elevado" }
    );
    expect(prompt).not.toContain("Contexto macro de hoy");
  });
});
