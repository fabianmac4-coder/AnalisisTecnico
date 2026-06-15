import { MacroDataCard } from "./MacroDataCard";
import type { MacroIndicator } from "./macroTypes";

const KEYS = [
  "fedFundsRate",
  "gdpGrowth",
  "industrialProduction",
  "retailSales",
  "consumerConfidence",
];

/** Indicadores macro de EE.UU. (Fed, PIB, ISM, confianza). */
export function UsaIndicatorsPanel({ indicators }: { indicators: Record<string, MacroIndicator> }) {
  const cards = KEYS.map((k) => indicators[k]).filter(Boolean);
  if (cards.length === 0) return null;
  return (
    <section data-testid="usa-indicators-panel">
      <h2 className="mb-2 text-sm font-bold text-gray-100">Indicadores de EE.UU.</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((ind) => (
          <MacroDataCard key={ind.key} indicator={ind} />
        ))}
      </div>
    </section>
  );
}
