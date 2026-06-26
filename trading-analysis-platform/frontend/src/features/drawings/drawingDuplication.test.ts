import { describe, it, expect } from "vitest";
import { duplicateDrawing } from "./drawingDuplication";
import type { Drawing } from "./drawingTypes";

function line(): Drawing {
  return {
    id: "100", // id de servidor (numérico)
    symbol: "AAPL",
    c030Id: 7,
    sourceTimeframe: "1Y_1D",
    type: "free_line",
    points: [
      { time: 1_000_000, price: 100 },
      { time: 2_000_000, price: 110 },
    ],
    style: {
      color: "#ff0000",
      width: 2,
      lineStyle: "solid",
      opacity: 1,
      chartSlotId: "chart_2",
    },
    visible: true,
    locked: false,
    showOnAllTimeframes: true,
    showOnTimeframes: ["1Y_1D"],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    version: 3,
  };
}

function positionBox(): Drawing {
  return {
    ...line(),
    id: "200",
    type: "LONG_POSITION",
    showOnAllTimeframes: false,
    points: [
      { time: 1_000_000, price: 100 }, // entry
      { time: 2_000_000, price: 110 }, // target
      { time: 2_000_000, price: 95 }, // stop
    ],
    style: {
      ...line().style,
      position: { toolType: "LONG_POSITION", quantity: 10 },
    },
  };
}

describe("duplicateDrawing", () => {
  it("crea una copia con id NUEVO no numérico (=> se crea en el backend)", () => {
    const dup = duplicateDrawing(line());
    expect(dup.id).not.toBe("100");
    expect(/^\d+$/.test(dup.id)).toBe(false); // no es id de servidor => upsert crea
  });

  it("conserva tipo, workspace, temporalidad, estilo y visibilidad global", () => {
    const dup = duplicateDrawing(line());
    expect(dup.type).toBe("free_line");
    expect(dup.c030Id).toBe(7);
    expect(dup.sourceTimeframe).toBe("1Y_1D");
    expect(dup.style.color).toBe("#ff0000");
    expect(dup.style.chartSlotId).toBe("chart_2");
    expect(dup.showOnAllTimeframes).toBe(true); // se replica en las seis gráficas
    expect(dup.visible).toBe(true);
    expect(dup.locked).toBe(false);
  });

  it("desplaza los puntos (precio arriba) conservando la forma", () => {
    const d = line();
    const dup = duplicateDrawing(d);
    // Precio desplazado hacia arriba.
    expect(dup.points[0].price).toBeGreaterThan(d.points[0].price);
    // Misma DIFERENCIA entre puntos (traslación, no deformación).
    const origDelta = d.points[1].price - d.points[0].price;
    const dupDelta = dup.points[1].price - dup.points[0].price;
    expect(dupDelta).toBeCloseTo(origDelta, 6);
  });

  it("caja LONG conserva la estructura riesgo/recompensa (distancias)", () => {
    const d = positionBox();
    const dup = duplicateDrawing(d);
    const riesgoOrig = d.points[0].price - d.points[2].price; // entry - stop
    const recompOrig = d.points[1].price - d.points[0].price; // target - entry
    const riesgoDup = dup.points[0].price - dup.points[2].price;
    const recompDup = dup.points[1].price - dup.points[0].price;
    expect(riesgoDup).toBeCloseTo(riesgoOrig, 6);
    expect(recompDup).toBeCloseTo(recompOrig, 6);
    // La caja de posición NO es global (se mantiene acotada a su temporalidad).
    expect(dup.showOnAllTimeframes).toBe(false);
    expect(dup.style.position?.quantity).toBe(10);
  });
});
