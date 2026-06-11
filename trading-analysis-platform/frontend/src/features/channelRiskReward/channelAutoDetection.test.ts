// Tests de la auto-deteccion de canales (matematica pura, tiempos en ms).
import { describe, it, expect } from "vitest";
import { detectChannels, slopesAreParallel } from "./channelAutoDetection";
import type { Drawing } from "@/features/drawings/drawingTypes";

const DAY = 86_400_000;

function line(
  id: string,
  p1: { time: number; price: number },
  p2: { time: number; price: number },
  type: Drawing["type"] = "free_line",
  sourceTimeframe = "1Y_1D"
): Drawing {
  return {
    id,
    symbol: "AAPL",
    sourceTimeframe,
    type,
    points: [p1, p2],
    style: { color: "#fff", width: 2, lineStyle: "solid", opacity: 1 },
    visible: true,
    locked: false,
    showOnAllTimeframes: true,
    createdAt: "",
    updatedAt: "",
    version: 3,
  } as Drawing;
}

// Canal alcista paralelo: inferior 100->110, superior 115->125 (en 10 dias).
const LOWER = line("low", { time: 0, price: 100 }, { time: 10 * DAY, price: 110 });
const UPPER = line("up", { time: 0, price: 115 }, { time: 10 * DAY, price: 125 });

describe("slopesAreParallel", () => {
  it("acepta pendientes identicas y rechaza muy distintas", () => {
    const s = 10 / (10 * DAY);
    expect(slopesAreParallel(s, s, 110)).toBe(true);
    expect(slopesAreParallel(s, s * 1.05, 110)).toBe(true); // 5% de diferencia
    expect(slopesAreParallel(s, -s, 110)).toBe(false); // pendientes opuestas
  });
});

describe("detectChannels", () => {
  it("detecta dos Free Lines paralelas y asigna superior/inferior por precio", () => {
    // Referencia 112 (dentro del canal) en t=5d: inferior=105, superior=120.
    const { best } = detectChannels([LOWER, UPPER], 112, 5 * DAY);
    expect(best).not.toBeNull();
    expect(best!.upper.drawingId).toBe("up");
    expect(best!.lower.drawingId).toBe("low");
    expect(best!.result.upperChannelPrice).toBeCloseTo(120, 4);
    expect(best!.result.lowerChannelPrice).toBeCloseTo(105, 4);
    // R/R = (120-112)/(112-105) = 8/7 ≈ 1.14
    expect(best!.result.ratio).toBeCloseTo(8 / 7, 2);
    expect(best!.confidence).toBeGreaterThan(0.5);
  });

  it("no detecta canal si las lineas no son paralelas", () => {
    const cruzada = line("x", { time: 0, price: 115 }, { time: 10 * DAY, price: 95 });
    const { best } = detectChannels([LOWER, cruzada], 105, 5 * DAY);
    expect(best).toBeNull();
  });

  it("no detecta canal si la referencia esta muy fuera del canal", () => {
    const { best } = detectChannels([LOWER, UPPER], 200, 5 * DAY);
    expect(best).toBeNull();
  });

  it("ignora lineas ocultas y dibujos que no son lineas", () => {
    const hidden = { ...UPPER, visible: false } as Drawing;
    const rect = line("r", { time: 0, price: 90 }, { time: 5 * DAY, price: 130 }, "rectangle");
    const { best } = detectChannels([LOWER, hidden, rect], 112, 5 * DAY);
    expect(best).toBeNull();
  });

  it("prefiere el canal de la temporalidad indicada", () => {
    const upWeekly = line("upW", { time: 0, price: 114 }, { time: 10 * DAY, price: 124 }, "free_line", "4Y_1W");
    const { best } = detectChannels([LOWER, UPPER, upWeekly], 112, 5 * DAY, "4Y_1W");
    // Ambos pares son validos; el de 4Y_1W gana por el bonus de temporalidad.
    expect(best!.upper.sourceTimeframe).toBe("4Y_1W");
  });

  it("la referencia exactamente en el canal inferior produce invalidReason", () => {
    const { best } = detectChannels([LOWER, UPPER], 105, 5 * DAY);
    expect(best).not.toBeNull();
    expect(best!.result.invalidReason).toContain("riesgo");
  });
});
