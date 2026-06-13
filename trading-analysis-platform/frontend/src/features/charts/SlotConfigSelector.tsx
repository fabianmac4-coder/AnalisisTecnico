// Selectores de range + interval para un slot de grafica. Cambiarlos afecta
// SOLO el slot del workspace activo (persiste en C030) y recarga ese slot.
// El selector de intervalo SOLO muestra intervalos disponibles para el rango
// elegido (sin opciones deshabilitadas).

import { showToast } from "@/components/ui/toastStore";
import {
  CHART_RANGES,
  INTERVAL_LABEL,
  RANGE_LABEL,
  type CandleInterval,
  type ChartRange,
} from "./chartWorkspaceTypes";
import {
  availableIntervalsForRange,
  coerceIntervalForRange,
} from "./chartRangeIntervalConfig";

interface Props {
  range: ChartRange;
  interval: CandleInterval;
  disabled?: boolean;
  onChange: (range: ChartRange, interval: CandleInterval) => void;
}

const selectClass =
  "rounded bg-panel-3 px-1 py-0.5 text-[10px] text-gray-200 outline-none hover:bg-edge disabled:opacity-50";

/** Dos `select` compactos (range / interval) para la cabecera de un panel. */
export function SlotConfigSelector({ range, interval, disabled, onChange }: Props) {
  const intervals = availableIntervalsForRange(range);

  function handleRange(nextRange: ChartRange) {
    // Si el intervalo actual no aplica al nuevo rango, se ajusta al default del
    // rango y se avisa con un toast sutil.
    const nextInterval = coerceIntervalForRange(nextRange, interval);
    if (nextInterval !== interval) {
      showToast(
        `Intervalo ajustado a ${nextInterval} para el rango ${nextRange}.`,
        "info"
      );
    }
    onChange(nextRange, nextInterval);
  }

  return (
    <div className="flex items-center gap-1" data-testid="slot-config-selector">
      <select
        aria-label="Rango"
        className={selectClass}
        value={range}
        disabled={disabled}
        onChange={(e) => handleRange(e.target.value as ChartRange)}
      >
        {CHART_RANGES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <select
        aria-label="Intervalo"
        className={selectClass}
        value={interval}
        disabled={disabled}
        onChange={(e) => onChange(range, e.target.value as CandleInterval)}
        title={`${RANGE_LABEL[range]} · ${INTERVAL_LABEL[interval]}`}
      >
        {intervals.map((iv) => (
          <option key={iv} value={iv}>
            {iv}
          </option>
        ))}
      </select>
    </div>
  );
}
