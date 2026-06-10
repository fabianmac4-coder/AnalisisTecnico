// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { canonicalPriceLineColor } from "./chartEngine/LightweightChartsAdapter";

describe("canonicalPriceLineColor", () => {
  it("verde cuando la cotizacion sube", () => {
    expect(canonicalPriceLineColor(1.35)).toBe("#22c55e");
    expect(canonicalPriceLineColor(0.01)).toBe("#22c55e");
  });

  it("rojo cuando la cotizacion baja", () => {
    expect(canonicalPriceLineColor(-2.4)).toBe("#ef4444");
  });

  it("gris neutro con cambio 0, null o invalido", () => {
    expect(canonicalPriceLineColor(0)).toBe("#e5e7eb");
    expect(canonicalPriceLineColor(null)).toBe("#e5e7eb");
    expect(canonicalPriceLineColor(undefined)).toBe("#e5e7eb");
    expect(canonicalPriceLineColor(NaN)).toBe("#e5e7eb");
  });
});
