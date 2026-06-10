import type { ChartType } from "./chartEngine/ChartEngineAdapter";

const TYPES: { type: ChartType; label: string; icon: string }[] = [
  { type: "candlestick", label: "Velas", icon: "▥" },
  { type: "bars", label: "Barras OHLC", icon: "╫" },
  { type: "line", label: "Línea", icon: "／" },
  { type: "area", label: "Área", icon: "◣" },
  { type: "volume", label: "Volumen", icon: "▮" },
];

interface Props {
  value: ChartType;
  onChange: (type: ChartType) => void;
  compact?: boolean;
}

export function ChartTypeSelector({ value, onChange, compact = false }: Props) {
  return (
    <div className="flex items-center gap-0.5">
      {TYPES.map((t) => (
        <button
          key={t.type}
          title={t.label}
          onClick={() => onChange(t.type)}
          className={[
            "rounded px-1.5 py-0.5 text-xs transition-colors",
            value === t.type ? "bg-accent text-white" : "text-muted hover:bg-panel-3",
          ].join(" ")}
        >
          {compact ? t.icon : t.label}
        </button>
      ))}
    </div>
  );
}
