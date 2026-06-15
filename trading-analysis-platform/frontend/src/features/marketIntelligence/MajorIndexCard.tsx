import type { MarketIndexDto } from "./marketIntelligenceTypes";

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1.5 h-7 w-full" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

const fmt = (v: number | null): string =>
  v == null ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** Tarjeta de un índice principal: precio, cambio %, tendencia y sparkline. */
export function MajorIndexCard({ index }: { index: MarketIndexDto }) {
  const cp = index.changePercent;
  const positive = (cp ?? 0) > 0;
  const negative = (cp ?? 0) < 0;
  const color = cp == null ? "#9ca3af" : positive ? "#26a69a" : negative ? "#ef5350" : "#9ca3af";
  const arrow = index.trend === "UP" ? "▲" : index.trend === "DOWN" ? "▼" : "▬";

  return (
    <div
      data-testid={`index-card-${index.symbol}`}
      className="rounded-lg border border-edge bg-panel-2 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-gray-100">{index.name}</p>
          <p className="text-[10px] text-muted">{index.symbol}</p>
        </div>
        <span className="font-mono text-sm" style={{ color }}>
          {arrow}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="font-mono text-base font-semibold text-gray-100">
          {fmt(index.price)}
        </span>
        <span className="font-mono text-xs font-semibold" style={{ color }}>
          {cp == null ? "—" : `${positive ? "+" : ""}${cp.toFixed(2)}%`}
        </span>
      </div>
      <Sparkline points={index.sparkline.map((s) => s.value)} color={color} />
    </div>
  );
}
