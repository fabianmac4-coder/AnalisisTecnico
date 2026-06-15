// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { StockScorecardFullView } from "./StockScorecardFullView";
import { useStockScorecardStore } from "./stockScorecardStore";
import { useScorecardConfigStore } from "./scorecardConfigStore";
import { DEFAULT_SCORECARD_CONFIG } from "./scorecardConfigTypes";
import type {
  ScorecardBreakdown,
  StockScorecardResponse,
} from "./stockScorecardTypes";

function breakdown(): ScorecardBreakdown {
  return {
    technical: {
      score: 72,
      metrics: [
        {
          key: "rsi14", label: "RSI 14", value: 62.4, displayValue: "62.4",
          source: "Internal technical calculation", status: "POSITIVE",
          scoreContribution: 15, maxContribution: 15,
          explanation: "RSI en zona constructiva.",
        },
      ],
    },
    fundamentals: {
      score: 64,
      metrics: [
        {
          key: "peRatio", label: "P/E", value: 22, displayValue: "22.0",
          source: "Yahoo Finance", status: "NEUTRAL",
          scoreContribution: 5, maxContribution: 13, explanation: "P/E algo elevado.",
        },
        {
          key: "roe", label: "ROE", value: 0.3, displayValue: "30.0%",
          source: "Yahoo Finance", status: "POSITIVE",
          scoreContribution: 10, maxContribution: 10, explanation: "ROE excelente.",
        },
      ],
    },
    news: { score: null, metrics: [] },
    sentiment: { score: null, metrics: [] },
  };
}

function scorecard(): StockScorecardResponse {
  return {
    symbol: "AAPL", companyName: "Apple Inc.",
    technicalScore: 72, fundamentalScore: 64, newsScore: null, sentimentScore: null,
    overallScore: 68, riskLevel: "MEDIUM", confidenceLevel: "MEDIUM",
    overallView: "INTERESTING_BUT_WAIT_FOR_PULLBACK",
    summary: "Resumen.", strengths: [], risks: [], watchItems: [],
    dataAvailability: { technical: true, fundamentals: true, news: false, sentiment: false },
    lastUpdated: "2026-06-13T00:00:00Z", warnings: [],
    breakdown: breakdown(),
    scoringConfig: { c081Id: 7, name: "Default", version: 1 },
  };
}

beforeEach(() => {
  useStockScorecardStore.setState({
    bySymbol: { AAPL: scorecard() },
    loadingBySymbol: {},
    errorBySymbol: {},
    expandedBySymbol: {},
    load: vi.fn().mockResolvedValue(undefined),
  });
  useScorecardConfigStore.setState({
    defaultConfig: {
      c081Id: 7,
      name: "Default",
      isDefault: true,
      configuration: JSON.parse(JSON.stringify(DEFAULT_SCORECARD_CONFIG)),
    },
    configs: [
      {
        c081Id: 7,
        name: "Default",
        isDefault: true,
        configuration: JSON.parse(JSON.stringify(DEFAULT_SCORECARD_CONFIG)),
      },
    ],
    loading: false,
    saving: false,
    error: null,
    loadDefault: vi.fn().mockResolvedValue(undefined),
    loadConfigs: vi.fn().mockResolvedValue(undefined),
    saveConfig: vi.fn().mockResolvedValue(true),
    createConfig: vi.fn().mockResolvedValue(true),
    setDefault: vi.fn().mockResolvedValue(true),
    resetDefault: vi.fn().mockResolvedValue(true),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StockScorecardFullView", () => {
  it("renderiza las tarjetas de puntaje y la config usada", () => {
    render(<StockScorecardFullView symbol="AAPL" onClose={() => {}} />);
    expect(screen.getByTestId("scorecard-card-Técnico").textContent).toContain("72");
    expect(screen.getByText(/config: Default/)).toBeTruthy();
  });

  it("muestra métricas reales como tarjetas con fuente y contribución", () => {
    render(<StockScorecardFullView symbol="AAPL" onClose={() => {}} />);
    // Pestaña técnica por defecto: tarjetas, no una tabla plana.
    expect(screen.getByTestId("scorecard-metrics")).toBeTruthy();
    const card = screen.getByTestId("metric-card-rsi14");
    expect(card.textContent).toContain("RSI 14");
    expect(card.textContent).toContain("62.4");
    expect(card.textContent).toContain("Técnico"); // fuente (abreviada)
    expect(card.textContent).toContain("15 / 15 pts"); // contribución
  });

  it("cambia a la pestaña Fundamental y muestra P/E y ROE de Yahoo en tarjetas", () => {
    render(<StockScorecardFullView symbol="AAPL" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId("scorecard-tab-fundamentals"));
    const pe = screen.getByTestId("metric-card-peRatio");
    expect(pe.textContent).toContain("P/E");
    expect(pe.textContent).toContain("Yahoo");
    expect(pe.textContent).toContain("5 / 13 pts");
    expect(screen.getByTestId("metric-card-roe").textContent).toContain("ROE");
  });

  it("la pestaña Ajustes permite editar el umbral de P/E y guardar", async () => {
    render(<StockScorecardFullView symbol="AAPL" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId("scorecard-tab-settings"));
    expect(screen.getByTestId("scorecard-settings")).toBeTruthy();
    // La sección de valuación es colapsable: hay que abrirla.
    fireEvent.click(screen.getByText("Fundamental — Valuación (P/E)"));
    const input = screen.getByLabelText("P/E excelente ≤") as HTMLInputElement;
    expect(input.value).toBe("10");
    fireEvent.change(input, { target: { value: "50" } });
    fireEvent.click(screen.getByTestId("scorecard-settings-save"));
    const save = useScorecardConfigStore.getState().saveConfig as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(save).toHaveBeenCalled());
    const [, body] = save.mock.calls[0];
    expect(body.configuration.fundamentals.peRatio.excellentMax).toBe(50);
    // Recalcula el scorecard.
    await waitFor(() =>
      expect(useStockScorecardStore.getState().load).toHaveBeenCalledWith("AAPL", true)
    );
  });

  it("muestra error de validación si los pesos no suman 100", () => {
    render(<StockScorecardFullView symbol="AAPL" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId("scorecard-tab-settings"));
    // Pesos default suman 100: sin error y Guardar habilitado.
    expect(screen.queryByTestId("scorecard-weights-error")).toBeNull();
    fireEvent.change(screen.getByLabelText("Técnico"), { target: { value: "50" } });
    expect(screen.getByTestId("scorecard-weights-error")).toBeTruthy();
    expect(
      (screen.getByTestId("scorecard-settings-save") as HTMLButtonElement).disabled
    ).toBe(true);
    // Normalizar arregla el total.
    fireEvent.click(screen.getByTestId("scorecard-weights-normalize"));
    expect(screen.getByTestId("scorecard-weights-total").textContent).toBe("100%");
  });

  it("Restaurar default llama resetDefault", () => {
    render(<StockScorecardFullView symbol="AAPL" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId("scorecard-tab-settings"));
    fireEvent.click(screen.getByTestId("scorecard-settings-reset"));
    expect(useScorecardConfigStore.getState().resetDefault).toHaveBeenCalled();
  });

  it("Cerrar invoca onClose", () => {
    const onClose = vi.fn();
    render(<StockScorecardFullView symbol="AAPL" onClose={onClose} />);
    fireEvent.click(screen.getByTestId("scorecard-full-close"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("StockScorecardFullView — tooltips de ayuda (?)", () => {
  it("las tarjetas de puntaje (Técnico/Fundamental/Sentimiento) tienen icono '?'", () => {
    render(<StockScorecardFullView symbol="AAPL" onClose={() => {}} />);
    expect(screen.getByTestId("scorecard-info-technicalScore")).toBeTruthy();
    expect(screen.getByTestId("scorecard-info-fundamentalScore")).toBeTruthy();
    expect(screen.getByTestId("scorecard-info-sentimentScore")).toBeTruthy();
    expect(screen.getByTestId("scorecard-info-newsScore")).toBeTruthy();
    // General + riesgo + confianza también.
    expect(screen.getByTestId("scorecard-info-overallScore")).toBeTruthy();
    expect(screen.getByTestId("scorecard-info-riskLevel")).toBeTruthy();
    expect(screen.getByTestId("scorecard-info-confidence")).toBeTruthy();
  });

  it("click en el '?' del puntaje técnico muestra la explicación detallada", () => {
    render(<StockScorecardFullView symbol="AAPL" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId("scorecard-info-technicalScore"));
    const pop = screen.getByTestId("scorecard-info-popover-technicalScore");
    expect(pop.textContent).toMatch(/tendencia de precio/i);
    // Estructura enriquecida: cómo interpretarlo + lecturas + por qué importa.
    expect(pop.textContent).toMatch(/Cómo interpretarlo/i);
    expect(pop.textContent).toContain("Positiva:");
    expect(pop.textContent).toContain("Negativa:");
    expect(pop.textContent).toMatch(/Por qué importa/i);
  });

  it("la métrica técnica RSI muestra un '?' con su explicación", () => {
    render(<StockScorecardFullView symbol="AAPL" onClose={() => {}} />);
    const info = screen.getByTestId("scorecard-info-rsi14");
    expect(info).toBeTruthy();
    fireEvent.click(info);
    expect(
      screen.getByTestId("scorecard-info-popover-rsi14").textContent
    ).toMatch(/Fuerza Relativa/i);
  });

  it("la métrica fundamental P/E tiene un '?' con explicación (click móvil)", () => {
    render(<StockScorecardFullView symbol="AAPL" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId("scorecard-tab-fundamentals"));
    const info = screen.getByTestId("scorecard-info-peRatio");
    fireEvent.click(info);
    expect(
      screen.getByTestId("scorecard-info-popover-peRatio").textContent
    ).toMatch(/beneficio por acción/i);
  });
});
