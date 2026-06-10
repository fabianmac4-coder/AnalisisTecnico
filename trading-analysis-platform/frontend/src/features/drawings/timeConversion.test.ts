import { describe, it, expect } from "vitest";
import type { UTCTimestamp } from "lightweight-charts";
import { msToChartTime, chartTimeToMs } from "./timeConversion";

describe("timeConversion", () => {
  it("msToChartTime convierte ms a segundos (floor)", () => {
    expect(msToChartTime(1717372800000)).toBe(1717372800);
    expect(msToChartTime(1717372800999)).toBe(1717372800);
  });

  it("chartTimeToMs convierte segundos numericos a ms", () => {
    expect(chartTimeToMs(1717372800 as UTCTimestamp)).toBe(1717372800000);
  });

  it("chartTimeToMs maneja BusinessDay string (yyyy-mm-dd)", () => {
    expect(chartTimeToMs("2024-06-03")).toBe(Date.UTC(2024, 5, 3));
  });

  it("chartTimeToMs maneja BusinessDay objeto", () => {
    expect(chartTimeToMs({ year: 2024, month: 6, day: 3 })).toBe(Date.UTC(2024, 5, 3));
  });

  it("ida y vuelta ms -> chart -> ms preserva el segundo", () => {
    const ms = 1717372800000;
    expect(chartTimeToMs(msToChartTime(ms))).toBe(ms);
  });
});
