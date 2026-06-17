import { describe, it, expect } from "vitest";
import {
  buildPositionBoxPoints,
  dragPositionBoxPoints,
  resizePositionBoxRightEdge,
} from "./positionBoxGeometry";
import type { DrawingPoint } from "./drawingTypes";

// entry@1000ms, target/stop@2000ms (endTime). Los tiempos NO deben cambiar al
// arrastrar manijas de precio.
const longOriginal: DrawingPoint[] = [
  { time: 1000, price: 100 }, // entry
  { time: 2000, price: 110 }, // target (arriba)
  { time: 2000, price: 95 }, // stop (abajo)
];
const shortOriginal: DrawingPoint[] = [
  { time: 1000, price: 100 }, // entry
  { time: 2000, price: 90 }, // target (abajo)
  { time: 2000, price: 105 }, // stop (arriba)
];

describe("dragPositionBoxPoints — LONG", () => {
  it("1) arrastrar TARGET cambia solo el objetivo; entry/stop intactos", () => {
    const r = dragPositionBoxPoints({ type: "LONG_POSITION", original: longOriginal, handleIndex: 1, pointerPrice: 120 });
    expect(r[1].price).toBe(120);
    expect(r[0].price).toBe(100);
    expect(r[2].price).toBe(95);
    expect(r[1].time).toBe(2000); // tiempo preservado
  });

  it("2) arrastrar STOP cambia solo el stop; target/entry intactos", () => {
    const r = dragPositionBoxPoints({ type: "LONG_POSITION", original: longOriginal, handleIndex: 2, pointerPrice: 90 });
    expect(r[2].price).toBe(90);
    expect(r[1].price).toBe(110);
    expect(r[0].price).toBe(100);
  });

  it("3) arrastrar ENTRY mueve las tres líneas preservando distancias", () => {
    const r = dragPositionBoxPoints({ type: "LONG_POSITION", original: longOriginal, handleIndex: 0, pointerPrice: 105 });
    expect(r[0].price).toBe(105);
    expect(r[1].price).toBe(115); // 110 + 5
    expect(r[2].price).toBe(100); // 95 + 5
    expect(r[0].time).toBe(1000);
    expect(r[1].time).toBe(2000);
  });

  it("8a) TARGET no puede cruzar por debajo de entry (clamp)", () => {
    const r = dragPositionBoxPoints({ type: "LONG_POSITION", original: longOriginal, handleIndex: 1, pointerPrice: 80 });
    expect(r[1].price).toBeGreaterThan(100);
    expect(r[1].price).toBeCloseTo(100, 1);
  });

  it("8b) STOP no puede cruzar por encima de entry (clamp)", () => {
    const r = dragPositionBoxPoints({ type: "LONG_POSITION", original: longOriginal, handleIndex: 2, pointerPrice: 130 });
    expect(r[2].price).toBeLessThan(100);
    expect(r[2].price).toBeCloseTo(100, 1);
  });
});

describe("dragPositionBoxPoints — SHORT", () => {
  it("4) arrastrar TARGET cambia solo el objetivo; entry/stop intactos", () => {
    const r = dragPositionBoxPoints({ type: "SHORT_POSITION", original: shortOriginal, handleIndex: 1, pointerPrice: 85 });
    expect(r[1].price).toBe(85);
    expect(r[0].price).toBe(100);
    expect(r[2].price).toBe(105);
  });

  it("5) arrastrar STOP cambia solo el stop; entry/target intactos", () => {
    const r = dragPositionBoxPoints({ type: "SHORT_POSITION", original: shortOriginal, handleIndex: 2, pointerPrice: 110 });
    expect(r[2].price).toBe(110);
    expect(r[1].price).toBe(90);
    expect(r[0].price).toBe(100);
  });

  it("6) arrastrar ENTRY mueve las tres líneas preservando distancias", () => {
    const r = dragPositionBoxPoints({ type: "SHORT_POSITION", original: shortOriginal, handleIndex: 0, pointerPrice: 95 });
    expect(r[0].price).toBe(95);
    expect(r[1].price).toBe(85); // 90 - 5
    expect(r[2].price).toBe(100); // 105 - 5
  });

  it("8c) TARGET no puede cruzar por encima de entry (clamp)", () => {
    const r = dragPositionBoxPoints({ type: "SHORT_POSITION", original: shortOriginal, handleIndex: 1, pointerPrice: 120 });
    expect(r[1].price).toBeLessThan(100);
    expect(r[1].price).toBeCloseTo(100, 1);
  });

  it("8d) STOP no puede cruzar por debajo de entry (clamp)", () => {
    const r = dragPositionBoxPoints({ type: "SHORT_POSITION", original: shortOriginal, handleIndex: 2, pointerPrice: 70 });
    expect(r[2].price).toBeGreaterThan(100);
    expect(r[2].price).toBeCloseTo(100, 1);
  });
});

describe("dragPositionBoxPoints — robustez", () => {
  it("no compone sobre valores ya mutados (siempre desde `original`)", () => {
    // Dos arrastres consecutivos del mismo original deben ser independientes.
    const a = dragPositionBoxPoints({ type: "LONG_POSITION", original: longOriginal, handleIndex: 1, pointerPrice: 115 });
    const b = dragPositionBoxPoints({ type: "LONG_POSITION", original: longOriginal, handleIndex: 1, pointerPrice: 120 });
    expect(a[1].price).toBe(115);
    expect(b[1].price).toBe(120);
    // El original no se mutó.
    expect(longOriginal[1].price).toBe(110);
  });

  it("buildPositionBoxPoints arma los 3 puntos canónicos (entry/target/stop)", () => {
    const pts = buildPositionBoxPoints({
      entryTime: 1000, endTime: 2000, entryPrice: 100, targetPrice: 110, stopPrice: 95,
    });
    expect(pts).toEqual([
      { time: 1000, price: 100 },
      { time: 2000, price: 110 },
      { time: 2000, price: 95 },
    ]);
  });
});

describe("resizePositionBoxRightEdge — duración horizontal", () => {
  it("extiende endTime sin tocar precios ni la entrada (LONG)", () => {
    const r = resizePositionBoxRightEdge({ original: longOriginal, newEndTime: 3000 });
    expect(r[1].time).toBe(3000); // target endTime
    expect(r[2].time).toBe(3000); // stop endTime
    expect(r[0].time).toBe(1000); // entryTime intacto
    expect(r[0].price).toBe(100); // precios intactos
    expect(r[1].price).toBe(110);
    expect(r[2].price).toBe(95);
  });

  it("encoge endTime (sigue > entryTime)", () => {
    const r = resizePositionBoxRightEdge({ original: longOriginal, newEndTime: 1500 });
    expect(r[1].time).toBe(1500);
    expect(r[2].time).toBe(1500);
    expect(r[0].time).toBe(1000);
  });

  it("clampa endTime para que no cruce ni toque entryTime", () => {
    const r = resizePositionBoxRightEdge({ original: longOriginal, newEndTime: 500, minStepMs: 10 });
    expect(r[1].time).toBe(1010); // entryTime(1000) + minStep(10)
    expect(r[1].time).toBeGreaterThan(r[0].time);
  });

  it("funciona igual para SHORT (solo cambia endTime)", () => {
    const r = resizePositionBoxRightEdge({ original: shortOriginal, newEndTime: 4000 });
    expect(r[1].time).toBe(4000);
    expect(r[2].time).toBe(4000);
    expect(r[1].price).toBe(90);
    expect(r[2].price).toBe(105);
  });
});
