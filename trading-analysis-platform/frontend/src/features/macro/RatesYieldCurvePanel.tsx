import { MacroDataCard } from "./MacroDataCard";
import { MacroInfoTooltip } from "./MacroInfoTooltip";
import { CURVE_LABEL_ES, type MacroIndicator, type MacroRates, type YieldCurveStatus } from "./macroTypes";

const CURVE_COLOR: Record<YieldCurveStatus, string> = {
  NORMAL: "#22c55e",
  FLAT: "#f59e0b",
  INVERTED: "#ef4444",
  UNKNOWN: "#6b7280",
};

const ORDER = ["treasury2Y", "treasury5Y", "treasury10Y", "treasury30Y"];
const LABELS = ["2A", "5A", "10A", "30A"];

function ind(rates: MacroRates, key: string): MacroIndicator | undefined {
  const v = rates[key];
  return v && typeof v === "object" ? (v as MacroIndicator) : undefined;
}

function CurveLine({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p) => p.v != null) as { v: number; i: number }[];
  if (pts.length < 2) return null;
  const vals = pts.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 200;
  const h = 48;
  const stepX = w / (values.length - 1);
  const d = pts
    .map((p, idx) => {
      const x = p.i * stepX;
      const y = h - ((p.v - min) / range) * (h - 8) - 4;
      return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} className="mt-2 h-16 w-full">
      <path d={d} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      {pts.map((p) => {
        const x = p.i * stepX;
        const y = h - ((p.v - min) / range) * (h - 8) - 4;
        return <circle key={p.i} cx={x} cy={y} r="2" fill="#3b82f6" />;
      })}
      {LABELS.map((l, i) => (
        <text key={l} x={i * stepX} y={h + 11} fontSize="8" fill="#8b93a7" textAnchor="middle">
          {l}
        </text>
      ))}
    </svg>
  );
}

/** Tasas del Tesoro + estado de la curva de rendimientos. */
export function RatesYieldCurvePanel({ rates }: { rates: MacroRates }) {
  const cards = ORDER.map((k) => ind(rates, k)).filter(Boolean) as MacroIndicator[];
  const spread = ind(rates, "yieldCurve10Y2Y");
  const status = rates.curveStatus;
  const color = CURVE_COLOR[status];

  return (
    <section
      data-testid="rates-panel"
      className="rounded-lg border border-edge bg-panel p-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-100">Tasas y curva de rendimientos</h2>
        <span
          data-testid="curve-status-badge"
          className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${color}22`, color }}
        >
          Curva: {CURVE_LABEL_ES[status]}
        </span>
      </div>

      {cards.length === 0 ? (
        <p className="text-xs text-muted">Datos de tasas no disponibles ahora mismo.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cards.map((c) => (
              <MacroDataCard key={c.key} indicator={c} />
            ))}
          </div>
          <CurveLine values={ORDER.map((k) => ind(rates, k)?.value ?? null)} />
        </>
      )}
      {spread && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
          <span>
            Spread 10A-2A: <span className="font-mono">{spread.displayValue}</span>
            {spread.explanation && ` — ${spread.explanation}`}
          </span>
          <MacroInfoTooltip helpKey="yieldCurve10Y2Y" />
        </p>
      )}
    </section>
  );
}
