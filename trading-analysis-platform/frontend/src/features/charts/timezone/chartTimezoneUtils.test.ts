import { describe, it, expect } from "vitest";
import { formatChartTime, resolveTimeZone, defaultTimezoneSetting } from "./chartTimezoneUtils";

// 2026-06-18 14:30:00 UTC
const MS = Date.UTC(2026, 5, 18, 14, 30, 0);

describe("formatChartTime", () => {
  it("UTC mode formatea en UTC (14:30)", () => {
    const s = formatChartTime({ timestamp: MS, setting: { mode: "UTC" } });
    expect(s).toMatch(/14:30/);
    expect(s).toMatch(/Jun 18, 2026/);
  });

  it("acepta timestamp en segundos sin mutar los datos", () => {
    const sec = Math.floor(MS / 1000);
    const fromSec = formatChartTime({ timestamp: sec, timestampUnit: "seconds", setting: { mode: "UTC" } });
    const fromMs = formatChartTime({ timestamp: MS, setting: { mode: "UTC" } });
    expect(fromSec).toBe(fromMs);
  });

  it("FIXED_OFFSET -06:00 desplaza la etiqueta a 08:30 (display only)", () => {
    const s = formatChartTime({ timestamp: MS, setting: { mode: "FIXED_OFFSET", value: "-06:00" } });
    expect(s).toMatch(/08:30/);
  });

  it("FIXED_OFFSET +09:00 desplaza a 23:30", () => {
    const s = formatChartTime({ timestamp: MS, setting: { mode: "FIXED_OFFSET", value: "+09:00" } });
    expect(s).toMatch(/23:30/);
  });

  it("IANA America/Mexico_City (UTC-6) muestra 08:30", () => {
    const s = formatChartTime({ timestamp: MS, setting: { mode: "IANA", value: "America/Mexico_City" } });
    expect(s).toMatch(/08:30/);
  });

  it("EXCHANGE usa la zona del exchange (New York, UTC-4 en verano) -> 10:30", () => {
    const s = formatChartTime({
      timestamp: MS, setting: { mode: "EXCHANGE" }, exchangeTimezone: "America/New_York",
    });
    expect(s).toMatch(/10:30/);
  });

  it("includeDate/includeTime controlan las partes mostradas", () => {
    const onlyTime = formatChartTime({ timestamp: MS, setting: { mode: "UTC" }, includeDate: false });
    expect(onlyTime).toMatch(/14:30/);
    expect(onlyTime).not.toMatch(/2026/);
  });
});

describe("resolveTimeZone + defaultTimezoneSetting", () => {
  it("UTC/IANA/EXCHANGE/LOCAL resuelven la zona esperada", () => {
    expect(resolveTimeZone({ mode: "UTC" })).toBe("UTC");
    expect(resolveTimeZone({ mode: "IANA", value: "Asia/Tokyo" })).toBe("Asia/Tokyo");
    expect(resolveTimeZone({ mode: "EXCHANGE" }, "America/New_York")).toBe("America/New_York");
    expect(resolveTimeZone({ mode: "LOCAL" })).toBeUndefined();
  });
  it("default es EXCHANGE con zona, LOCAL sin ella", () => {
    expect(defaultTimezoneSetting("America/New_York").mode).toBe("EXCHANGE");
    expect(defaultTimezoneSetting(null).mode).toBe("LOCAL");
  });
});
