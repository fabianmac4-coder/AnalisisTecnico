// Controles del Modo Replay (práctica histórica). Se usa en la barra del
// dashboard y en la gráfica maximizada. NO monta el temporizador de
// reproducción (eso lo hace useReplayPlayback una sola vez en ChartGrid); aquí
// solo se cambia el estado del replayStore.

import { useReplayStore } from "./replayStore";
import {
  REPLAY_SPEED_OPTIONS,
  defaultReplayCursor,
  nextReplayTime,
  prevReplayTime,
} from "./replayUtils";

interface Props {
  symbol: string;
  /** Tiempos (ms UTC, ascendentes) de la temporalidad de referencia para los pasos. */
  referenceTimes: number[];
  /** Aviso opcional (p. ej. auto-recarga activa). */
  note?: string | null;
}

/** ms UTC -> valor de un <input type="datetime-local"> en hora LOCAL. */
function toLocalInputValue(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const btn =
  "rounded bg-panel-3 px-2 py-0.5 text-[11px] text-gray-200 hover:bg-edge disabled:opacity-40";

export function ReplayControls({ symbol, referenceTimes, note }: Props) {
  const enabled = useReplayStore((s) => s.enabled);
  const cursorTime = useReplayStore((s) => s.cursorTime);
  const playing = useReplayStore((s) => s.playing);
  const selecting = useReplayStore((s) => s.selecting);
  const speed = useReplayStore((s) => s.speedMultiplier);
  const enable = useReplayStore((s) => s.enable);
  const disable = useReplayStore((s) => s.disable);
  const setCursor = useReplayStore((s) => s.setCursor);
  const setSelecting = useReplayStore((s) => s.setSelecting);
  const setSpeed = useReplayStore((s) => s.setSpeed);
  const setPlaying = useReplayStore((s) => s.setPlaying);

  if (!enabled) {
    return (
      <button
        type="button"
        data-testid="replay-enable"
        disabled={referenceTimes.length === 0}
        onClick={() => enable(symbol, defaultReplayCursor(referenceTimes))}
        title="Modo Replay: ocultar el futuro y practicar proyecciones"
        className={btn}
      >
        ⏵ Modo Replay
      </button>
    );
  }

  const next = nextReplayTime(referenceTimes, cursorTime);
  const prev = prevReplayTime(referenceTimes, cursorTime);

  function onDateChange(value: string) {
    if (!value) return;
    const ms = new Date(value).getTime();
    if (!Number.isNaN(ms)) setCursor(ms);
  }

  return (
    <div
      data-testid="replay-controls"
      className="flex flex-wrap items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1"
    >
      <span
        data-testid="replay-badge"
        className="text-[10px] font-semibold uppercase tracking-wide text-amber-300"
      >
        ⏺ Replay activo: datos futuros ocultos
      </span>

      <button
        type="button"
        data-testid="replay-select-start"
        onClick={() => setSelecting(!selecting)}
        className={`${btn} ${selecting ? "outline outline-1 outline-amber-400" : ""}`}
        title="Seleccionar punto de inicio: haz clic en una vela"
      >
        🎯 {selecting ? "Clic en una vela…" : "Seleccionar punto de inicio"}
      </button>

      <label className="flex items-center gap-1 text-[10px] text-muted">
        Fecha de corte
        <input
          type="datetime-local"
          data-testid="replay-cutoff-input"
          value={toLocalInputValue(cursorTime)}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded bg-panel px-1 py-0.5 text-[10px] text-gray-200 outline-none"
        />
      </label>

      <button
        type="button"
        data-testid="replay-step-back"
        disabled={prev == null}
        onClick={() => prev != null && setCursor(prev)}
        title="Retroceder vela"
        className={btn}
      >
        ◀
      </button>
      <button
        type="button"
        data-testid="replay-play"
        onClick={() => setPlaying(!playing)}
        title={playing ? "Pausar" : "Reproducir"}
        className={btn}
      >
        {playing ? "⏸ Pausar" : "▶ Reproducir"}
      </button>
      <button
        type="button"
        data-testid="replay-step-forward"
        disabled={next == null}
        onClick={() => next != null && setCursor(next)}
        title="Avanzar vela"
        className={btn}
      >
        ▶|
      </button>

      <label className="flex items-center gap-1 text-[10px] text-muted">
        Velocidad
        <select
          data-testid="replay-speed"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="rounded bg-panel px-1 py-0.5 text-[10px] text-gray-200 outline-none"
        >
          {REPLAY_SPEED_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        data-testid="replay-disable"
        onClick={() => disable()}
        title="Desactivar Replay"
        className={btn}
      >
        ✕ Desactivar Replay
      </button>

      {note && <span className="text-[10px] italic text-amber-300/80">{note}</span>}
    </div>
  );
}
