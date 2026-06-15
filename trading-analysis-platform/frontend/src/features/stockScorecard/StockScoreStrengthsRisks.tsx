// Listas de fortalezas / riesgos / a vigilar del scorecard.

function List({
  title,
  items,
  icon,
  className,
  testid,
}: {
  title: string;
  items: string[];
  icon: string;
  className: string;
  testid: string;
}) {
  if (items.length === 0) return null;
  return (
    <div data-testid={testid}>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className={`flex gap-1 text-[11px] leading-snug ${className}`}>
            <span className="shrink-0">{icon}</span>
            <span className="text-gray-200">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  strengths: string[];
  risks: string[];
  watchItems: string[];
}

export function StockScoreStrengthsRisks({ strengths, risks, watchItems }: Props) {
  return (
    <div className="space-y-2">
      <List
        title="Fortalezas"
        items={strengths}
        icon="✓"
        className="text-up"
        testid="scorecard-strengths"
      />
      <List
        title="Riesgos"
        items={risks}
        icon="⚠"
        className="text-down"
        testid="scorecard-risks"
      />
      <List
        title="A vigilar"
        items={watchItems}
        icon="•"
        className="text-amber-400"
        testid="scorecard-watch"
      />
    </div>
  );
}
