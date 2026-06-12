// Tests de la auto-deteccion de canales (matematica pura, tiempos en ms).
// REGLA CLAVE: la deteccion automatica es ESTRICTA por temporalidad de origen
// (un canal de 4Y_1W no calcula en 1Y_1D ni al reves).
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  detectChannels,
  linesAreParallel,
  pairAngleDifferenceDegrees,
  CHANNEL_ANGLE_TOLERANCE_DEGREES,
} from "./channelAutoDetection";
import { normalizeChartTimeToMs } from "@/features/drawings/timeConversion";
import type { Drawing } from "@/features/drawings/drawingTypes";

const DAY = 86_400_000;

function line(
  id: string,
  p1: { time: number; price: number },
  p2: { time: number; price: number },
  type: Drawing["type"] = "free_line",
  sourceTimeframe = "1Y_1D",
  extra: Partial<Drawing> = {}
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
    ...extra,
  } as Drawing;
}

// Canal alcista paralelo: inferior 100->110, superior 115->125 (en 10 dias).
const LOWER = line("low", { time: 0, price: 100 }, { time: 10 * DAY, price: 110 });
const UPPER = line("up", { time: 0, price: 115 }, { time: 10 * DAY, price: 125 });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeChartTimeToMs", () => {
  it("convierte segundos a ms y deja los ms intactos", () => {
    expect(normalizeChartTimeToMs(1_700_000_000)).toBe(1_700_000_000_000);
    expect(normalizeChartTimeToMs(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(normalizeChartTimeToMs(0)).toBe(0);
  });
});

describe("comparacion de angulos (normalizada, no pendiente cruda en ms)", () => {
  const toLine = (d: Drawing) => ({
    drawingId: d.id,
    time1: d.points[0].time,
    price1: d.points[0].price,
    time2: d.points[1].time,
    price2: d.points[1].price,
  });

  it("lineas identicas en pendiente -> 0 grados", () => {
    expect(pairAngleDifferenceDegrees(toLine(LOWER), toLine(UPPER), 112)).toBeCloseTo(0, 5);
  });

  it("pendientes parecidas son paralelas; cruzadas no", () => {
    const similar = toLine(
      line("s", { time: 0, price: 115 }, { time: 10 * DAY, price: 128 })
    );
    const cruzada = toLine(
      line("x", { time: 0, price: 115 }, { time: 10 * DAY, price: 95 })
    );
    expect(linesAreParallel(toLine(LOWER), similar, 112)).toBe(true);
    expect(linesAreParallel(toLine(LOWER), cruzada, 112)).toBe(false);
    expect(
      pairAngleDifferenceDegrees(toLine(LOWER), cruzada, 112)
    ).toBeGreaterThan(CHANNEL_ANGLE_TOLERANCE_DEGREES);
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
    expect(best!.referenceInside).toBe(true);
    expect(best!.note).toBeNull();
  });

  it("ESTRICTO por temporalidad: lineas de 4Y_1W no calculan en 1Y_1D ni al reves", () => {
    const lower4y = line("low4", { time: 0, price: 100 }, { time: 10 * DAY, price: 110 }, "free_line", "4Y_1W");
    const upper4y = line("up4", { time: 0, price: 115 }, { time: 10 * DAY, price: 125 }, "free_line", "4Y_1W");
    // Aunque showOnAllTimeframes=true (visual), el calculo NO cruza presets.
    const on4y = detectChannels([lower4y, upper4y], 112, 5 * DAY, { timeframe: "4Y_1W" });
    const on1y = detectChannels([lower4y, upper4y], 112, 5 * DAY, { timeframe: "1Y_1D" });
    expect(on4y.best).not.toBeNull();
    expect(on4y.best!.timeframe).toBe("4Y_1W");
    expect(on1y.best).toBeNull();
  });

  it("no empareja lineas de temporalidades distintas en modo estricto", () => {
    const lower4y = line("low4", { time: 0, price: 100 }, { time: 10 * DAY, price: 110 }, "free_line", "4Y_1W");
    // UPPER es de 1Y_1D: ni 4Y_1W ni 1Y_1D tienen un par completo.
    expect(detectChannels([lower4y, UPPER], 112, 5 * DAY, { timeframe: "4Y_1W" }).best).toBeNull();
    expect(detectChannels([lower4y, UPPER], 112, 5 * DAY, { timeframe: "1Y_1D" }).best).toBeNull();
  });

  it("cada temporalidad obtiene SU canal (sin mezclar resultados)", () => {
    const lower1y = line("l1", { time: 0, price: 100 }, { time: 10 * DAY, price: 110 }, "free_line", "1Y_1D");
    const upper1y = line("u1", { time: 0, price: 115 }, { time: 10 * DAY, price: 125 }, "free_line", "1Y_1D");
    const lower4y = line("l4", { time: 0, price: 90 }, { time: 10 * DAY, price: 100 }, "free_line", "4Y_1W");
    const upper4y = line("u4", { time: 0, price: 125 }, { time: 10 * DAY, price: 135 }, "free_line", "4Y_1W");
    const all = [lower1y, upper1y, lower4y, upper4y];
    const on1y = detectChannels(all, 112, 5 * DAY, { timeframe: "1Y_1D" }).best;
    const on4y = detectChannels(all, 112, 5 * DAY, { timeframe: "4Y_1W" }).best;
    expect(on1y!.upper.drawingId).toBe("u1");
    expect(on1y!.lower.drawingId).toBe("l1");
    expect(on4y!.upper.drawingId).toBe("u4");
    expect(on4y!.lower.drawingId).toBe("l4");
  });

  it("detecta lineas con rangos de tiempo distintos (solape parcial)", () => {
    const upperShifted = line("upS", { time: 4 * DAY, price: 119 }, { time: 14 * DAY, price: 129 });
    const { best } = detectChannels([LOWER, upperShifted], 112, 8 * DAY);
    expect(best).not.toBeNull();
    expect(best!.upper.drawingId).toBe("upS");
  });

  it("detecta lineas SIN solape temporal (extrapola al tiempo de referencia)", () => {
    const lowerOld = line("lo", { time: 0, price: 100 }, { time: 4 * DAY, price: 104 });
    const upperNew = line("un", { time: 6 * DAY, price: 121 }, { time: 10 * DAY, price: 125 });
    const { best } = detectChannels([lowerOld, upperNew], 116, 10 * DAY);
    expect(best).not.toBeNull();
    // En t=10d: inferior extrapolada = 110, superior = 125.
    expect(best!.result.lowerChannelPrice).toBeCloseTo(110, 4);
    expect(best!.result.upperChannelPrice).toBeCloseTo(125, 4);
  });

  it("acepta canales estrechos (>= 0.5% de ancho)", () => {
    const flatLow = line("fl", { time: 0, price: 100 }, { time: 10 * DAY, price: 100 });
    const flatUp = line("fu", { time: 0, price: 100.8 }, { time: 10 * DAY, price: 100.8 });
    const { best } = detectChannels([flatLow, flatUp], 100.4, 5 * DAY);
    expect(best).not.toBeNull(); // ancho 0.8%: el minimo viejo (1%) lo rechazaba
  });

  it("referencia ligeramente fuera del canal: se detecta con nota", () => {
    // Canal en t=5d: [105, 120]; ref 125 esta fuera pero dentro del 10% tol.
    const { best } = detectChannels([LOWER, UPPER], 125, 5 * DAY);
    expect(best).not.toBeNull();
    expect(best!.referenceInside).toBe(false);
    expect(best!.note).toContain("fuera del canal");
    // Por encima del canal superior no hay recorrido: razon explicita, no ratio.
    expect(best!.result.invalidReason).toBeTruthy();
    expect(best!.result.ratio).toBeNull();
  });

  it("no detecta canal si la referencia esta MUY fuera del canal", () => {
    const { best } = detectChannels([LOWER, UPPER], 200, 5 * DAY);
    expect(best).toBeNull();
  });

  it("no detecta canal si las lineas no son paralelas", () => {
    const cruzada = line("x", { time: 0, price: 115 }, { time: 10 * DAY, price: 95 });
    const { best } = detectChannels([LOWER, cruzada], 105, 5 * DAY);
    expect(best).toBeNull();
  });

  it("ignora lineas ocultas, bloqueadas y dibujos que no son lineas", () => {
    const hidden = { ...UPPER, visible: false } as Drawing;
    const locked = { ...UPPER, id: "lk", locked: true } as Drawing;
    const rect = line("r", { time: 0, price: 90 }, { time: 5 * DAY, price: 130 }, "rectangle");
    expect(detectChannels([LOWER, hidden, rect], 112, 5 * DAY).best).toBeNull();
    expect(detectChannels([LOWER, locked], 112, 5 * DAY).best).toBeNull();
  });

  it("ignora lineas con puntos invalidos o degenerados", () => {
    const vertical = line("v", { time: 5 * DAY, price: 115 }, { time: 5 * DAY, price: 125 });
    const nan = line("n", { time: 0, price: Number.NaN }, { time: 10 * DAY, price: 125 });
    expect(detectChannels([LOWER, vertical, nan], 112, 5 * DAY).best).toBeNull();
  });

  it("acepta lineas dibujadas de derecha a izquierda (puntos invertidos)", () => {
    const upperReversed = line("upR", { time: 10 * DAY, price: 125 }, { time: 0, price: 115 });
    const { best } = detectChannels([LOWER, upperReversed], 112, 5 * DAY);
    expect(best).not.toBeNull();
    expect(best!.result.upperChannelPrice).toBeCloseTo(120, 4);
  });

  it("la referencia exactamente en el canal inferior produce invalidReason", () => {
    const { best } = detectChannels([LOWER, UPPER], 105, 5 * DAY);
    expect(best).not.toBeNull();
    expect(best!.result.invalidReason).toContain("riesgo");
  });

  it("modo debug: loguea razones de rechazo solo cuando esta activado", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const cruzada = line("x", { time: 0, price: 115 }, { time: 10 * DAY, price: 95 });

    detectChannels([LOWER, cruzada], 105, 5 * DAY, { debug: false });
    expect(spy).not.toHaveBeenCalled();

    detectChannels([LOWER, cruzada], 105, 5 * DAY, { debug: true, timeframe: "1Y_1D" });
    expect(spy).toHaveBeenCalled();
    const allArgs = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allArgs).toContain("[ChannelRR]");
    expect(allArgs).toContain("rechazado");
  });
});
