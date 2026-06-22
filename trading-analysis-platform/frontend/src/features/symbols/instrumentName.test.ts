import { describe, it, expect } from "vitest";
import { formatInstrumentDisplayName, firstNonEmpty } from "./instrumentName";

describe("formatInstrumentDisplayName", () => {
  it("muestra 'TICKER · Nombre' cuando se conoce el nombre", () => {
    expect(formatInstrumentDisplayName("AAPL", "Apple Inc.")).toBe("AAPL · Apple Inc.");
    expect(formatInstrumentDisplayName("TSM", "Taiwan Semiconductor")).toBe(
      "TSM · Taiwan Semiconductor"
    );
  });

  it("usa el primer nombre no vacío (catálogo y luego scorecard)", () => {
    expect(formatInstrumentDisplayName("AAPL", undefined, "Apple Inc.")).toBe("AAPL · Apple Inc.");
    expect(formatInstrumentDisplayName("AAPL", "", null, "Apple Inc.")).toBe("AAPL · Apple Inc.");
  });

  it("cae al ticker si no hay nombre conocido", () => {
    expect(formatInstrumentDisplayName("ZZZZ")).toBe("ZZZZ");
    expect(formatInstrumentDisplayName("ZZZZ", undefined, null, "  ")).toBe("ZZZZ");
  });

  it("no duplica cuando el nombre coincide con el ticker", () => {
    expect(formatInstrumentDisplayName("AAPL", "AAPL")).toBe("AAPL");
  });

  it("firstNonEmpty ignora vacíos/espacios", () => {
    expect(firstNonEmpty(undefined, "", "  ", "x")).toBe("x");
    expect(firstNonEmpty(null, "")).toBeUndefined();
  });
});
