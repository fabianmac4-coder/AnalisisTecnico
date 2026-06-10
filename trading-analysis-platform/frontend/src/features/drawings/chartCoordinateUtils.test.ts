import { describe, it, expect } from "vitest";
import {
  distancePointToSegment,
  localPointToDrawingPoint,
  pointerEventToLocalPoint,
  timeMsToCoordinateRobust,
} from "./chartCoordinateUtils";

describe("distancePointToSegment", () => {
  it("≈0 para un punto sobre el segmento", () => {
    expect(distancePointToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0, 5);
  });

  it("distancia perpendicular correcta", () => {
    expect(distancePointToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3, 5);
  });

  it("usa el extremo cuando el punto cae fuera de la proyeccion", () => {
    expect(distancePointToSegment({ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(4, 5);
  });

  it("segmento degenerado (a==b) = distancia al punto", () => {
    expect(distancePointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5, 5);
  });
});

describe("pointerEventToLocalPoint", () => {
  it("resta el offset del rect del stage", () => {
    const fakeStage = {
      getBoundingClientRect: () => ({ left: 100, top: 50 }) as DOMRect,
    } as unknown as Element;
    const local = pointerEventToLocalPoint({ clientX: 130, clientY: 70 }, fakeStage);
    expect(local).toEqual({ x: 30, y: 20 });
  });
});

describe("timeMsToCoordinateRobust (interpolacion entre coordenadas de velas REALES)", () => {
  // Chart "semanal": nativo SOLO para los timestamps de sus velas/whitespace.
  // La x es por INDICE (deliberadamente NO proporcional al calendario): entre
  // 14s y 70s hay un hueco enorme de calendario que ocupa solo 100 px, como un
  // fin de semana. Esto demuestra que NO se interpola sobre el ancho total.
  const NATIVE_X: Record<number, number> = {
    0: 0,
    7: 100,
    14: 200,
    70: 300, // ultima vela real
    77: 310, // whitespace futuro
    84: 320, // whitespace futuro
  };
  const chart = {
    timeScale: () => ({
      timeToCoordinate: (tSec: number) => NATIVE_X[tSec] ?? null,
    }),
  } as unknown as import("lightweight-charts").IChartApi;
  const bars = [{ time: 0 }, { time: 7000 }, { time: 14_000 }, { time: 70_000 }];
  const future = { lastBarTimeMs: 70_000, lastBarIndex: 3, stepMs: 7000 };

  it("usa la conversion nativa cuando el timestamp existe en la escala", () => {
    expect(timeMsToCoordinateRobust({ timeMs: 7000, chart, bars })).toBe(100);
  });

  it("interpola entre las coordenadas reales de las velas vecinas, NO sobre el ancho", () => {
    // 42s esta entre las velas 14s(x=200) y 70s(x=300): ratio 0.5 -> 250.
    // Interpolacion de calendario sobre un ancho de 1000 daria ~600 (mal).
    expect(timeMsToCoordinateRobust({ timeMs: 42_000, chart, bars })).toBe(250);
  });

  it("el whitespace futuro NO desplaza los puntos historicos", () => {
    expect(timeMsToCoordinateRobust({ timeMs: 42_000, chart, bars, future })).toBe(250);
  });

  it("tiempos futuros interpolan sobre el grid de whitespace (nativo en sus nodos)", () => {
    // 73.5s: entre la ultima vela 70s(x=300) y whitespace 77s(x=310) -> 305.
    expect(timeMsToCoordinateRobust({ timeMs: 73_500, chart, bars, future })).toBe(305);
    // 80.5s: entre whitespace 77s(310) y 84s(320) -> 315.
    expect(timeMsToCoordinateRobust({ timeMs: 80_500, chart, bars, future })).toBe(315);
  });

  it("antes de la primera vela o futuro sin grid -> null (se omite, no se inventa)", () => {
    expect(timeMsToCoordinateRobust({ timeMs: -5000, chart, bars })).toBeNull();
    expect(timeMsToCoordinateRobust({ timeMs: 80_500, chart, bars })).toBeNull(); // sin future
    // Mas alla del whitespace generado: nativo null en t1 -> null.
    expect(timeMsToCoordinateRobust({ timeMs: 95_000, chart, bars, future })).toBeNull();
  });
});

describe("localPointToDrawingPoint (fallback futuro)", () => {
  // Chart simulado: coordinateToTime devuelve null mas alla de x=100 (fin de
  // datos+whitespace), pero coordinateToLogical sigue funcionando.
  const chart = {
    timeScale: () => ({
      coordinateToTime: (x: number) => (x <= 100 ? x : null),
      coordinateToLogical: (x: number) => x, // 1 pixel = 1 indice logico
    }),
  } as unknown as import("lightweight-charts").IChartApi;
  const series = {
    coordinateToPrice: (y: number) => 1000 - y,
  } as unknown as import("lightweight-charts").ISeriesApi<"Candlestick">;

  const future = { lastBarTimeMs: 100_000, lastBarIndex: 100, stepMs: 1_000 };

  it("dentro del dominio usa coordinateToTime (segundos -> ms)", () => {
    const dp = localPointToDrawingPoint({ x: 50, y: 30 }, chart, series, future);
    expect(dp).toEqual({ time: 50_000, price: 970 });
  });

  it("mas alla del dominio estima el tiempo futuro con el indice logico", () => {
    // x=110 -> logical 110 > lastBarIndex 100 -> time = 100000 + 10*1000.
    const dp = localPointToDrawingPoint({ x: 110, y: 30 }, chart, series, future);
    expect(dp).toEqual({ time: 110_000, price: 970 });
  });

  it("sin info de futuro, fuera del dominio devuelve null (no crashea)", () => {
    expect(localPointToDrawingPoint({ x: 110, y: 30 }, chart, series, null)).toBeNull();
  });
});
