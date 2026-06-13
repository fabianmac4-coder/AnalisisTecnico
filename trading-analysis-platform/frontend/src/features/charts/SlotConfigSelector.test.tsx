// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { SlotConfigSelector } from "./SlotConfigSelector";
import type { CandleInterval, ChartRange } from "./chartWorkspaceTypes";

afterEach(() => cleanup());

function intervalOptions(): string[] {
  const sel = screen.getByLabelText("Intervalo") as HTMLSelectElement;
  return Array.from(sel.options).map((o) => o.value);
}

describe("SlotConfigSelector", () => {
  it("renderiza selectores de rango e intervalo con el valor actual", () => {
    render(<SlotConfigSelector range="1Y" interval="1d" onChange={() => {}} />);
    expect((screen.getByLabelText("Rango") as HTMLSelectElement).value).toBe("1Y");
    expect((screen.getByLabelText("Intervalo") as HTMLSelectElement).value).toBe("1d");
  });

  it("cambiar el intervalo llama onChange con el mismo rango", () => {
    const onChange = vi.fn();
    render(<SlotConfigSelector range="1Y" interval="1d" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Intervalo"), { target: { value: "1h" } });
    expect(onChange).toHaveBeenCalledWith("1Y", "1h");
  });

  it("cambiar a un rango incompatible ajusta el intervalo al default", () => {
    const onChange = vi.fn();
    render(<SlotConfigSelector range="1D" interval="1m" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Rango"), { target: { value: "5Y" } });
    expect(onChange).toHaveBeenCalledWith("5Y", "1wk"); // 5Y/1m invalido -> 1wk
  });

  it("conserva el intervalo si sigue siendo valido para el nuevo rango", () => {
    const onChange = vi.fn();
    render(<SlotConfigSelector range="1Y" interval="1d" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Rango"), { target: { value: "5Y" } });
    expect(onChange).toHaveBeenCalledWith("5Y", "1d"); // 1d valido en 5Y
  });

  // Solo deben mostrarse intervalos disponibles (sin opciones deshabilitadas).
  const cases: Record<ChartRange, CandleInterval[]> = {
    "5Y": ["1mo", "1wk", "1d"],
    "1Y": ["1mo", "1wk", "1d", "1h"],
    "6M": ["1wk", "1d", "1h", "30m", "15m"],
    "3M": ["1wk", "1d", "1h", "30m", "15m"],
    "1M": ["1d", "1h", "30m", "15m", "5m"],
    "1W": ["1h", "30m", "15m", "5m", "1m"],
    "1D": ["30m", "15m", "5m", "1m"],
  };

  for (const [range, intervals] of Object.entries(cases)) {
    it(`el selector para ${range} muestra solo ${intervals.join(", ")}`, () => {
      render(
        <SlotConfigSelector
          range={range as ChartRange}
          interval={intervals[0]}
          onChange={() => {}}
        />
      );
      expect(intervalOptions()).toEqual(intervals);
    });
  }

  it("nunca renderiza opciones de intervalo deshabilitadas", () => {
    render(<SlotConfigSelector range="5Y" interval="1wk" onChange={() => {}} />);
    const sel = screen.getByLabelText("Intervalo") as HTMLSelectElement;
    expect(Array.from(sel.options).some((o) => o.disabled)).toBe(false);
    expect(intervalOptions()).not.toContain("1m");
    expect(intervalOptions()).not.toContain("1h");
  });
});
