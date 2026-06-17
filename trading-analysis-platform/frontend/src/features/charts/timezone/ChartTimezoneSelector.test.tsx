// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { ChartTimezoneSelector } from "./ChartTimezoneSelector";
import { useChartTimezoneStore } from "./chartTimezoneStore";
import { LS_TIMEZONE_MODE, LS_TIMEZONE_VALUE } from "./chartTimezoneTypes";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  useChartTimezoneStore.setState({ setting: { mode: "EXCHANGE" } });
});
afterEach(() => cleanup());

describe("ChartTimezoneSelector", () => {
  it("renderiza el selector con el exchange en la opción Exchange", () => {
    render(<ChartTimezoneSelector exchangeTimezone="America/New_York" />);
    const sel = screen.getByTestId("chart-timezone-select") as HTMLSelectElement;
    expect(sel).toBeTruthy();
    expect(screen.getByText(/Exchange \(America\/New_York\)/)).toBeTruthy();
  });

  it("seleccionar UTC actualiza el store y persiste en localStorage", () => {
    render(<ChartTimezoneSelector exchangeTimezone={null} />);
    fireEvent.change(screen.getByTestId("chart-timezone-select"), { target: { value: "UTC" } });
    expect(useChartTimezoneStore.getState().setting).toEqual({ mode: "UTC" });
    expect(localStorage.getItem(LS_TIMEZONE_MODE)).toBe("UTC");
  });

  it("seleccionar un offset fijo guarda mode+value", () => {
    render(<ChartTimezoneSelector exchangeTimezone={null} />);
    fireEvent.change(screen.getByTestId("chart-timezone-select"), {
      target: { value: "FIXED_OFFSET:-06:00" },
    });
    expect(useChartTimezoneStore.getState().setting).toEqual({ mode: "FIXED_OFFSET", value: "-06:00" });
    expect(localStorage.getItem(LS_TIMEZONE_MODE)).toBe("FIXED_OFFSET");
    expect(localStorage.getItem(LS_TIMEZONE_VALUE)).toBe("-06:00");
  });

  it("seleccionar una zona IANA guarda mode+value", () => {
    render(<ChartTimezoneSelector exchangeTimezone={null} />);
    fireEvent.change(screen.getByTestId("chart-timezone-select"), {
      target: { value: "IANA:America/Mexico_City" },
    });
    expect(useChartTimezoneStore.getState().setting).toEqual({
      mode: "IANA", value: "America/Mexico_City",
    });
  });
});
