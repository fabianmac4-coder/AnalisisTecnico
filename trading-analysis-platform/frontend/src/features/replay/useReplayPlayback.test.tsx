// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { useReplayPlayback } from "./useReplayPlayback";
import { useReplayStore } from "./replayStore";
import { replayStepMs } from "./replayUtils";

function Host({ times }: { times: number[] }) {
  useReplayPlayback(times);
  return null;
}

beforeEach(() => {
  useReplayStore.setState({
    enabled: false,
    symbol: null,
    cursorTime: null,
    speedMultiplier: 1,
    playing: false,
    selecting: false,
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useReplayPlayback", () => {
  it("avanza el cursor vela a vela mientras reproduce y pausa al final", () => {
    vi.useFakeTimers();
    useReplayStore.setState({
      enabled: true,
      symbol: "AAPL",
      cursorTime: 10,
      playing: true,
      speedMultiplier: 1,
    });
    render(<Host times={[10, 20, 30]} />);
    const step = replayStepMs(1);

    act(() => vi.advanceTimersByTime(step));
    expect(useReplayStore.getState().cursorTime).toBe(20);

    act(() => vi.advanceTimersByTime(step));
    expect(useReplayStore.getState().cursorTime).toBe(30);

    // En la última vela no hay siguiente: se pausa solo.
    act(() => vi.advanceTimersByTime(step));
    expect(useReplayStore.getState().playing).toBe(false);
  });

  it("no avanza si no está reproduciendo", () => {
    vi.useFakeTimers();
    useReplayStore.setState({
      enabled: true,
      symbol: "AAPL",
      cursorTime: 10,
      playing: false,
    });
    render(<Host times={[10, 20, 30]} />);
    act(() => vi.advanceTimersByTime(replayStepMs(1) * 3));
    expect(useReplayStore.getState().cursorTime).toBe(10);
  });
});
