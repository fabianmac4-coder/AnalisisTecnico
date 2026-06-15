import { MacroDataCard } from "./MacroDataCard";
import type { MacroIndicator } from "./macroTypes";

const KEYS = ["cpi", "pce", "unemploymentRate", "nonFarmPayrolls"];

/** Inflación y mercado laboral (CPI, PCE, desempleo, nóminas). */
export function InflationLaborPanel({ indicators }: { indicators: Record<string, MacroIndicator> }) {
  const cards = KEYS.map((k) => indicators[k]).filter(Boolean);
  if (cards.length === 0) return null;
  return (
    <section data-testid="inflation-labor-panel">
      <h2 className="mb-2 text-sm font-bold text-gray-100">Inflación y empleo</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((ind) => (
          <MacroDataCard key={ind.key} indicator={ind} />
        ))}
      </div>
    </section>
  );
}
