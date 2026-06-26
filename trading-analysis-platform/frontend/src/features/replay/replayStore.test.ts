import { describe, it, expect, beforeEach } from "vitest";
import { useReplayStore } from "./replayStore";

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

describe("replayStore", () => {
  it("enable activa el replay con símbolo y cursor", () => {
    useReplayStore.getState().enable("AAPL", 1000);
    const s = useReplayStore.getState();
    expect(s.enabled).toBe(true);
    expect(s.symbol).toBe("AAPL");
    expect(s.cursorTime).toBe(1000);
    expect(s.playing).toBe(false);
  });

  it("disable restablece y limpia el cursor", () => {
    useReplayStore.getState().enable("AAPL", 1000);
    useReplayStore.getState().setPlaying(true);
    useReplayStore.getState().disable();
    const s = useReplayStore.getState();
    expect(s.enabled).toBe(false);
    expect(s.cursorTime).toBeNull();
    expect(s.playing).toBe(false);
    expect(s.selecting).toBe(false);
  });

  it("setCursor fija el corte y termina la selección", () => {
    useReplayStore.getState().setSelecting(true);
    useReplayStore.getState().setCursor(5000);
    const s = useReplayStore.getState();
    expect(s.cursorTime).toBe(5000);
    expect(s.selecting).toBe(false);
  });

  it("setSpeed y setPlaying actualizan el estado", () => {
    useReplayStore.getState().setSpeed(5);
    useReplayStore.getState().setPlaying(true);
    const s = useReplayStore.getState();
    expect(s.speedMultiplier).toBe(5);
    expect(s.playing).toBe(true);
  });
});
