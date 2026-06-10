import { describe, it, expect } from "vitest";
import { resolveDisplayPrice, PRICE_FALLBACK_ORDER } from "./priceResolver";
import type { OHLCVResponse, QuoteResponse } from "@/services/apiClient";
import type { PresetKey } from "@/utils/timeframes";

function quote(price: number): QuoteResponse {
  return { symbol: "AAPL", price, source: "yfinance", timestamp: 0 };
}

function ohlcv(preset: PresetKey, close: number): OHLCVResponse {
  return {
    symbol: "AAPL",
    preset,
    interval: "1d",
    bars: [{ time: 1, open: close, high: close, low: close, close }],
  };
}

describe("resolveDisplayPrice", () => {
  it("usa quote.price cuando hay cotizacion (fuente canonica)", () => {
    const r = resolveDisplayPrice(quote(123.45), { "1W_30M": ohlcv("1W_30M", 999) });
    expect(r.price).toBe(123.45);
    expect(r.source).toBe("quote");
  });

  it("sin quote, elige 1W_30M primero (mayor resolucion)", () => {
    const r = resolveDisplayPrice(undefined, {
      "4Y_1W": ohlcv("4Y_1W", 400),
      "1Y_1D": ohlcv("1Y_1D", 410),
      "1W_30M": ohlcv("1W_30M", 305),
    });
    expect(r.price).toBe(305);
    expect(r.source).toBe("1W_30M");
  });

  it("sin quote, cae al siguiente disponible si falta 1W_30M", () => {
    const r = resolveDisplayPrice(undefined, { "1Y_1D": ohlcv("1Y_1D", 410) });
    expect(r.price).toBe(410);
    expect(r.source).toBe("1Y_1D");
  });

  it("devuelve null si no hay ni quote ni barras", () => {
    const r = resolveDisplayPrice(undefined, {});
    expect(r.price).toBeNull();
    expect(r.source).toBe("none");
  });

  it("ignora quote con precio NaN y cae al fallback", () => {
    const bad = { ...quote(NaN) };
    const r = resolveDisplayPrice(bad, { "3M_1D": ohlcv("3M_1D", 290) });
    expect(r.price).toBe(290);
  });

  it("el orden de fallback prioriza intradia sobre diario amplio", () => {
    expect(PRICE_FALLBACK_ORDER[0]).toBe("1W_30M");
    expect(PRICE_FALLBACK_ORDER[PRICE_FALLBACK_ORDER.length - 1]).toBe("4Y_1W");
  });
});
