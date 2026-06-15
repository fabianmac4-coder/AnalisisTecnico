import { MacroDataCard } from "./MacroDataCard";
import type { MacroIndicator } from "./macroTypes";

function Group({
  title,
  items,
  testid,
  helpKey,
}: {
  title: string;
  items: MacroIndicator[];
  testid: string;
  helpKey: string;
}) {
  if (items.length === 0) return null;
  return (
    <div data-testid={testid}>
      <p className="mb-1 text-[10px] font-semibold uppercase text-muted">{title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((i) => (
          <MacroDataCard key={i.key} indicator={i} helpKey={helpKey} />
        ))}
      </div>
    </div>
  );
}

/** Mercados globales: FX, materias primas y cripto (proxies de riesgo). */
export function GlobalMarketsPanel({
  globalMarkets,
}: {
  globalMarkets: { fx: MacroIndicator[]; commodities: MacroIndicator[]; crypto: MacroIndicator[] };
}) {
  const empty =
    globalMarkets.fx.length === 0 &&
    globalMarkets.commodities.length === 0 &&
    globalMarkets.crypto.length === 0;
  return (
    <section data-testid="global-markets-panel">
      <h2 className="mb-2 text-sm font-bold text-gray-100">Mercados globales</h2>
      {empty ? (
        <p className="rounded border border-edge bg-panel-2 px-3 py-3 text-xs text-muted">
          Datos de mercados globales no disponibles ahora mismo.
        </p>
      ) : (
        <div className="space-y-3">
          <Group title="Divisas (FX)" items={globalMarkets.fx} testid="fx-group" helpKey="fx" />
          <Group title="Materias primas" items={globalMarkets.commodities} testid="commodities-group" helpKey="commodities" />
          <Group title="Cripto" items={globalMarkets.crypto} testid="crypto-group" helpKey="crypto" />
        </div>
      )}
    </section>
  );
}
