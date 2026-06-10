import { describe, it, expect } from "vitest";
import {
  projectLineToVisibleRange,
  clipFreeLineSegmentToVisibleRange,
  overlapsVisibleRange,
} from "./drawingProjection";

describe("clipFreeLineSegmentToVisibleRange (free line = segmento finito)", () => {
  const p1 = { time: 100, price: 10 };
  const p2 = { time: 200, price: 20 }; // pendiente 0.1

  it("ambos extremos visibles -> devuelve EXACTAMENTE los puntos originales", () => {
    const r = clipFreeLineSegmentToVisibleRange({ p1, p2, visibleStartMs: 0, visibleEndMs: 1000 });
    expect(r).toEqual([
      { time: 100, price: 10 },
      { time: 200, price: 20 },
    ]);
  });

  it("no se extiende mas alla de los puntos aunque la vista sea enorme", () => {
    const r = clipFreeLineSegmentToVisibleRange({
      p1,
      p2,
      visibleStartMs: -100000,
      visibleEndMs: 100000,
    });
    // Sigue siendo [100, 200], NO [-100000, 100000].
    expect(r![0].time).toBe(100);
    expect(r![1].time).toBe(200);
  });

  it("parcialmente visible -> recorta solo el lado visible", () => {
    const r = clipFreeLineSegmentToVisibleRange({ p1, p2, visibleStartMs: 150, visibleEndMs: 1000 });
    expect(r![0]).toEqual({ time: 150, price: 15 }); // precio interpolado
    expect(r![1]).toEqual({ time: 200, price: 20 });
  });

  it("completamente fuera del rango visible -> null (no se dibuja)", () => {
    expect(
      clipFreeLineSegmentToVisibleRange({ p1, p2, visibleStartMs: 500, visibleEndMs: 1000 })
    ).toBeNull();
  });

  it("recta vertical (mismo time) o puntos invalidos -> null", () => {
    expect(
      clipFreeLineSegmentToVisibleRange({
        p1: { time: 5, price: 1 },
        p2: { time: 5, price: 9 },
        visibleStartMs: 0,
        visibleEndMs: 10,
      })
    ).toBeNull();
    expect(
      clipFreeLineSegmentToVisibleRange({
        p1: { time: NaN, price: 1 },
        p2,
        visibleStartMs: 0,
        visibleEndMs: 10,
      })
    ).toBeNull();
  });
});

describe("projectLineToVisibleRange", () => {
  it("evalua el precio en el inicio y fin visibles (pendiente 1)", () => {
    const r = projectLineToVisibleRange(
      [
        { time: 0, price: 0 },
        { time: 10, price: 10 },
      ],
      2,
      8
    );
    expect(r).not.toBeNull();
    expect(r![0]).toEqual({ time: 2, price: 2 });
    expect(r![1]).toEqual({ time: 8, price: 8 });
  });

  it("proyecta aunque los puntos originales esten fuera del rango visible", () => {
    // Recta corta (time 0..1) proyectada a una ventana lejana (100..200).
    const r = projectLineToVisibleRange(
      [
        { time: 0, price: 0 },
        { time: 1, price: 1 },
      ],
      100,
      200
    );
    expect(r![0].price).toBe(100);
    expect(r![1].price).toBe(200);
  });

  it("devuelve null para una recta vertical (mismo time)", () => {
    expect(
      projectLineToVisibleRange(
        [
          { time: 5, price: 1 },
          { time: 5, price: 9 },
        ],
        0,
        10
      )
    ).toBeNull();
  });

  it("no crashea con puntos faltantes", () => {
    expect(projectLineToVisibleRange([{ time: 1, price: 1 }], 0, 10)).toBeNull();
    expect(projectLineToVisibleRange([], 0, 10)).toBeNull();
  });
});

describe("overlapsVisibleRange", () => {
  it("detecta solape de rango de tiempo", () => {
    const pts = [
      { time: 50, price: 1 },
      { time: 150, price: 2 },
    ];
    expect(overlapsVisibleRange(pts, 100, 200)).toBe(true);
    expect(overlapsVisibleRange(pts, 300, 400)).toBe(false);
  });
});
