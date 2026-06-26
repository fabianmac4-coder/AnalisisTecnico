// Temporizador ÚNICO de reproducción del replay. Debe montarse UNA sola vez
// (en ChartGrid) para no crear timers duplicados. Avanza el cursor por los
// tiempos de la temporalidad de referencia hasta que se acaban (entonces pausa).

import { useEffect } from "react";
import { useReplayStore } from "./replayStore";
import { nextReplayTime, replayStepMs } from "./replayUtils";

export function useReplayPlayback(referenceTimes: number[]): void {
  const enabled = useReplayStore((s) => s.enabled);
  const playing = useReplayStore((s) => s.playing);
  const speed = useReplayStore((s) => s.speedMultiplier);

  useEffect(() => {
    if (!enabled || !playing || referenceTimes.length === 0) return;
    const stepMs = replayStepMs(speed);
    const timer = setInterval(() => {
      const { cursorTime, setCursor, setPlaying } = useReplayStore.getState();
      const next = nextReplayTime(referenceTimes, cursorTime);
      if (next == null) {
        setPlaying(false); // llegó al final: detener la reproducción
        return;
      }
      setCursor(next);
    }, stepMs);
    return () => clearInterval(timer);
  }, [enabled, playing, speed, referenceTimes]);
}
