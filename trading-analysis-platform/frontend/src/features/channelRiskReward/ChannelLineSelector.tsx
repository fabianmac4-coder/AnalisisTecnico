import type { Drawing } from "@/features/drawings/drawingTypes";

function lineLabel(d: Drawing): string {
  const [a, b] = d.points;
  const prices =
    a && b ? `${a.price.toFixed(2)} → ${b.price.toFixed(2)}` : "(incompleta)";
  const name = d.style?.label ? ` "${d.style.label}"` : "";
  return `${d.sourceTimeframe}${name} · ${prices}`;
}

/** Selector de una Free Line del simbolo activo (canal superior o inferior). */
export function ChannelLineSelector({
  label,
  freeLines,
  value,
  exclude,
  onChange,
  testId,
}: {
  label: string;
  freeLines: Drawing[];
  value: string | null;
  /** id ya usado por la otra banda (no seleccionable dos veces). */
  exclude?: string | null;
  onChange: (drawingId: string | null) => void;
  testId: string;
}) {
  return (
    <label className="block text-[11px] text-muted">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        data-testid={testId}
        className="mt-1 w-full rounded border border-edge bg-panel-2 px-2 py-1 text-[11px] text-gray-100 focus:border-accent focus:outline-none"
      >
        <option value="">— Selecciona una Free Line —</option>
        {freeLines
          .filter((d) => d.id !== exclude)
          .map((d) => (
            <option key={d.id} value={d.id}>
              {lineLabel(d)}
            </option>
          ))}
      </select>
    </label>
  );
}
