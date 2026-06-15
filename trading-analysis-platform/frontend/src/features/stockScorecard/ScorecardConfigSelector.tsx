// Selector del perfil de puntuación activo (config default). Cambiar de perfil
// marca ese C081 como default y recalcula el scorecard.
import { useScorecardConfigStore } from "./scorecardConfigStore";

export function ScorecardConfigSelector({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const configs = useScorecardConfigStore((s) => s.configs);
  const defaultConfig = useScorecardConfigStore((s) => s.defaultConfig);
  const setDefault = useScorecardConfigStore((s) => s.setDefault);

  if (configs.length === 0) return null;

  return (
    <label className="flex items-center gap-2 text-[11px] text-muted">
      <span>Perfil de puntuación:</span>
      <select
        data-testid="scorecard-profile-select"
        value={defaultConfig?.c081Id ?? ""}
        onChange={async (e) => {
          const ok = await setDefault(Number(e.target.value));
          if (ok) onChanged?.();
        }}
        className="rounded bg-panel-2 px-2 py-0.5 text-gray-100 outline-none"
      >
        {configs.map((c) => (
          <option key={c.c081Id} value={c.c081Id}>
            {c.name}
            {c.isDefault ? " ★" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
