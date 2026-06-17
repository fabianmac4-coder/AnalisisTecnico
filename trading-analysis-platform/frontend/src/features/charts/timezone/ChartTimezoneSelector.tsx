import { useChartTimezoneStore } from "./chartTimezoneStore";
import { FIXED_OFFSETS, IANA_PRESETS, type ChartTimezoneSetting } from "./chartTimezoneTypes";

// Valor compuesto del <select> -> ChartTimezoneSetting.
function encode(s: ChartTimezoneSetting): string {
  if (s.mode === "FIXED_OFFSET") return `FIXED_OFFSET:${s.value ?? ""}`;
  if (s.mode === "IANA") return `IANA:${s.value ?? ""}`;
  return s.mode;
}
function decode(raw: string): ChartTimezoneSetting {
  if (raw.startsWith("FIXED_OFFSET:")) return { mode: "FIXED_OFFSET", value: raw.slice(13) };
  if (raw.startsWith("IANA:")) return { mode: "IANA", value: raw.slice(5) };
  return { mode: raw as ChartTimezoneSetting["mode"] };
}

/** Selector "Zona horaria" para las etiquetas de tiempo de las gráficas. */
export function ChartTimezoneSelector({ exchangeTimezone }: { exchangeTimezone?: string | null }) {
  const setting = useChartTimezoneStore((s) => s.setting);
  const setSetting = useChartTimezoneStore((s) => s.setSetting);

  return (
    <label
      className="flex items-center gap-1 text-[11px] text-muted"
      title="Cambia cómo se muestran los tiempos de la gráfica. Los datos de las velas NO se modifican."
    >
      <span>Zona horaria</span>
      <select
        data-testid="chart-timezone-select"
        value={encode(setting)}
        onChange={(e) => setSetting(decode(e.target.value))}
        className="rounded border border-edge bg-panel-2 px-1.5 py-0.5 text-[11px] text-gray-100"
      >
        <optgroup label="Automático">
          <option value="EXCHANGE">
            Exchange{exchangeTimezone ? ` (${exchangeTimezone})` : ""}
          </option>
          <option value="LOCAL">Local (navegador)</option>
          <option value="UTC">UTC</option>
        </optgroup>
        <optgroup label="Offset UTC fijo">
          {FIXED_OFFSETS.map((o) => (
            <option key={o.value} value={`FIXED_OFFSET:${o.value}`}>
              {o.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Zonas (IANA)">
          {IANA_PRESETS.map((o) => (
            <option key={o.value} value={`IANA:${o.value}`}>
              {o.label}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
