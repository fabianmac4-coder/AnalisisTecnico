// Editor completo de la configuración de puntuación (C081): pesos + TODOS los
// umbrales (técnico/fundamental/noticias/sentimiento). Valida que los pesos
// sumen 100, permite normalizar, guardar, guardar como nuevo perfil y restaurar
// el default. Al guardar recalcula el scorecard. NO es asesoría financiera.
import { useEffect, useMemo, useState } from "react";
import { showToast } from "@/components/ui/toastStore";
import { Spinner } from "@/components/ui/Spinner";
import { useStockScorecardStore } from "./stockScorecardStore";
import {
  useScorecardConfigStore,
  weightsTotal,
  normalizeWeights,
} from "./scorecardConfigStore";
import { ScorecardConfigSelector } from "./ScorecardConfigSelector";
import { cloneConfig, type ScorecardConfig } from "./scorecardConfigTypes";

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] text-gray-300">
      <span className="truncate">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 rounded bg-panel-2 px-1.5 py-0.5 text-right text-gray-100 outline-none focus:border-accent"
      />
    </label>
  );
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded border border-edge">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted hover:bg-panel-3"
      >
        <span>{title}</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">{children}</div>
      )}
    </div>
  );
}

export function ScorecardSettings({ symbol }: { symbol: string }) {
  const entry = useScorecardConfigStore((s) => s.defaultConfig);
  const loadDefault = useScorecardConfigStore((s) => s.loadDefault);
  const saveConfig = useScorecardConfigStore((s) => s.saveConfig);
  const createConfig = useScorecardConfigStore((s) => s.createConfig);
  const resetDefault = useScorecardConfigStore((s) => s.resetDefault);
  const saving = useScorecardConfigStore((s) => s.saving);
  const reloadScorecard = useStockScorecardStore((s) => s.load);

  const [draft, setDraft] = useState<ScorecardConfig | null>(null);

  useEffect(() => {
    void loadDefault();
  }, [loadDefault]);
  useEffect(() => {
    if (entry) setDraft(cloneConfig(entry.configuration));
  }, [entry]);

  const c081Id = entry?.c081Id;
  const total = draft ? weightsTotal(draft) : 0;
  const weightsValid = Math.round(total) === 100;

  const set = useMemo(
    () => (mutator: (c: ScorecardConfig) => void) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = cloneConfig(prev);
        mutator(next);
        return next;
      });
    },
    []
  );

  if (!draft) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-muted">
        <Spinner size={16} /> Cargando configuración…
      </div>
    );
  }
  const f = draft.fundamentals;
  const t = draft.technical;

  async function recompute() {
    void reloadScorecard(symbol, true);
  }

  async function onSave() {
    if (c081Id == null || !weightsValid) return;
    const ok = await saveConfig(c081Id, { configuration: draft! });
    if (ok) {
      showToast("Scorecard settings saved", "success");
      void recompute();
    } else {
      showToast("No se pudo guardar la configuración", "error");
    }
  }

  async function onSaveAsNew() {
    if (!weightsValid) return;
    const name = window.prompt("Nombre del nuevo perfil:", "Mi perfil");
    if (!name || !name.trim()) return;
    const ok = await createConfig(name.trim(), draft!);
    if (ok) {
      showToast("Scoring profile created", "success");
      void recompute();
    } else {
      showToast("No se pudo crear el perfil", "error");
    }
  }

  async function onReset() {
    const ok = await resetDefault();
    if (ok) {
      showToast("Scorecard settings reset", "success");
      void recompute();
    }
  }

  return (
    <div className="space-y-2" data-testid="scorecard-settings">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ScorecardConfigSelector onChanged={recompute} />
        <p className="text-[10px] text-muted">
          Total pesos:{" "}
          <span
            data-testid="scorecard-weights-total"
            className={weightsValid ? "text-up" : "text-down"}
          >
            {total}%
          </span>
        </p>
      </div>

      <Section title="Pesos por categoría (%)" defaultOpen>
        <NumberField label="Técnico" value={draft.weights.technical}
          onChange={(v) => set((c) => { c.weights.technical = v; })} />
        <NumberField label="Fundamental" value={draft.weights.fundamentals}
          onChange={(v) => set((c) => { c.weights.fundamentals = v; })} />
        <NumberField label="Noticias" value={draft.weights.news}
          onChange={(v) => set((c) => { c.weights.news = v; })} />
        <NumberField label="Sentimiento" value={draft.weights.sentiment}
          onChange={(v) => set((c) => { c.weights.sentiment = v; })} />
        {!weightsValid && (
          <div className="col-span-full flex items-center justify-between gap-2">
            <span data-testid="scorecard-weights-error" className="text-[10px] text-down">
              Los pesos deben sumar 100.
            </span>
            <button
              type="button"
              data-testid="scorecard-weights-normalize"
              onClick={() => set((c) => { c.weights = normalizeWeights(c); })}
              className="rounded bg-panel-3 px-2 py-0.5 text-[10px] text-gray-200 hover:bg-edge"
            >
              Normalizar a 100%
            </button>
          </div>
        )}
      </Section>

      <Section title="Técnico — RSI">
        <NumberField label="RSI ideal mín" value={t.rsi.idealMin}
          onChange={(v) => set((c) => { c.technical.rsi.idealMin = v; })} />
        <NumberField label="RSI ideal máx" value={t.rsi.idealMax}
          onChange={(v) => set((c) => { c.technical.rsi.idealMax = v; })} />
        <NumberField label="RSI sobrecompra" value={t.rsi.overbought}
          onChange={(v) => set((c) => { c.technical.rsi.overbought = v; })} />
        <NumberField label="RSI sobreventa" value={t.rsi.oversold}
          onChange={(v) => set((c) => { c.technical.rsi.oversold = v; })} />
      </Section>

      <Section title="Técnico — Medias y Canal R/R">
        <NumberField label="Precio > SMA50 (pts)" value={t.movingAverages.priceAboveSma50Points}
          onChange={(v) => set((c) => { c.technical.movingAverages.priceAboveSma50Points = v; })} />
        <NumberField label="Precio > SMA200 (pts)" value={t.movingAverages.priceAboveSma200Points}
          onChange={(v) => set((c) => { c.technical.movingAverages.priceAboveSma200Points = v; })} />
        <NumberField label="SMA50 > SMA200 (pts)" value={t.movingAverages.sma50AboveSma200Points}
          onChange={(v) => set((c) => { c.technical.movingAverages.sma50AboveSma200Points = v; })} />
        <NumberField label="Canal R/R excelente ≥" value={t.channelRiskReward.excellentRatio} step={0.1}
          onChange={(v) => set((c) => { c.technical.channelRiskReward.excellentRatio = v; })} />
        <NumberField label="Canal R/R bueno ≥" value={t.channelRiskReward.goodRatio} step={0.1}
          onChange={(v) => set((c) => { c.technical.channelRiskReward.goodRatio = v; })} />
        <NumberField label="Canal R/R mínimo ≥" value={t.channelRiskReward.minimumAcceptableRatio} step={0.1}
          onChange={(v) => set((c) => { c.technical.channelRiskReward.minimumAcceptableRatio = v; })} />
      </Section>

      <Section title="Fundamental — Valuación (P/E)">
        <NumberField label="P/E excelente ≤" value={f.peRatio.excellentMax}
          onChange={(v) => set((c) => { c.fundamentals.peRatio.excellentMax = v; })} />
        <NumberField label="P/E bueno ≤" value={f.peRatio.goodMax}
          onChange={(v) => set((c) => { c.fundamentals.peRatio.goodMax = v; })} />
        <NumberField label="P/E caro >" value={f.peRatio.expensiveAbove}
          onChange={(v) => set((c) => { c.fundamentals.peRatio.expensiveAbove = v; })} />
        <NumberField label="P/E muy caro >" value={f.peRatio.veryExpensiveAbove}
          onChange={(v) => set((c) => { c.fundamentals.peRatio.veryExpensiveAbove = v; })} />
      </Section>

      <Section title="Fundamental — Rentabilidad (%)">
        <NumberField label="ROE excelente ≥" value={f.roe.excellentMin}
          onChange={(v) => set((c) => { c.fundamentals.roe.excellentMin = v; })} />
        <NumberField label="ROE bueno ≥" value={f.roe.goodMin}
          onChange={(v) => set((c) => { c.fundamentals.roe.goodMin = v; })} />
        <NumberField label="ROE débil <" value={f.roe.weakBelow}
          onChange={(v) => set((c) => { c.fundamentals.roe.weakBelow = v; })} />
        <NumberField label="ROA excelente ≥" value={f.roa.excellentMin}
          onChange={(v) => set((c) => { c.fundamentals.roa.excellentMin = v; })} />
        <NumberField label="ROA bueno ≥" value={f.roa.goodMin}
          onChange={(v) => set((c) => { c.fundamentals.roa.goodMin = v; })} />
        <NumberField label="ROA débil <" value={f.roa.weakBelow}
          onChange={(v) => set((c) => { c.fundamentals.roa.weakBelow = v; })} />
        <NumberField label="Margen excelente ≥" value={f.profitMargin.excellentMin}
          onChange={(v) => set((c) => { c.fundamentals.profitMargin.excellentMin = v; })} />
        <NumberField label="Margen bueno ≥" value={f.profitMargin.goodMin}
          onChange={(v) => set((c) => { c.fundamentals.profitMargin.goodMin = v; })} />
        <NumberField label="Margen débil <" value={f.profitMargin.weakBelow}
          onChange={(v) => set((c) => { c.fundamentals.profitMargin.weakBelow = v; })} />
      </Section>

      <Section title="Fundamental — Crecimiento y Balance">
        <NumberField label="Crec. ingresos excelente ≥" value={f.revenueGrowth.excellentMin}
          onChange={(v) => set((c) => { c.fundamentals.revenueGrowth.excellentMin = v; })} />
        <NumberField label="Crec. ingresos bueno ≥" value={f.revenueGrowth.goodMin}
          onChange={(v) => set((c) => { c.fundamentals.revenueGrowth.goodMin = v; })} />
        <NumberField label="Crec. negativo <" value={f.revenueGrowth.negativeBelow}
          onChange={(v) => set((c) => { c.fundamentals.revenueGrowth.negativeBelow = v; })} />
        <NumberField label="Deuda/Capital excelente ≤" value={f.debtToEquity.excellentMax}
          onChange={(v) => set((c) => { c.fundamentals.debtToEquity.excellentMax = v; })} />
        <NumberField label="Deuda/Capital bueno ≤" value={f.debtToEquity.goodMax}
          onChange={(v) => set((c) => { c.fundamentals.debtToEquity.goodMax = v; })} />
        <NumberField label="Deuda/Capital riesgoso >" value={f.debtToEquity.riskyAbove}
          onChange={(v) => set((c) => { c.fundamentals.debtToEquity.riskyAbove = v; })} />
        <NumberField label="Current ratio bueno ≥" value={f.currentRatio.goodMin} step={0.1}
          onChange={(v) => set((c) => { c.fundamentals.currentRatio.goodMin = v; })} />
        <NumberField label="Current ratio débil <" value={f.currentRatio.weakBelow} step={0.1}
          onChange={(v) => set((c) => { c.fundamentals.currentRatio.weakBelow = v; })} />
      </Section>

      <Section title="Noticias">
        <NumberField label="Boost titular positivo" value={draft.news.positiveHeadlineBoost}
          onChange={(v) => set((c) => { c.news.positiveHeadlineBoost = v; })} />
        <NumberField label="Penalización titular negativo" value={draft.news.negativeHeadlinePenalty}
          onChange={(v) => set((c) => { c.news.negativeHeadlinePenalty = v; })} />
        <NumberField label="Antigüedad máx (días)" value={draft.news.maxNewsAgeDays}
          onChange={(v) => set((c) => { c.news.maxNewsAgeDays = v; })} />
      </Section>

      <Section title="Sentimiento (VIX)">
        <NumberField label="VIX riesgo bajo ≤" value={draft.sentiment.vixLowRiskMax}
          onChange={(v) => set((c) => { c.sentiment.vixLowRiskMax = v; })} />
        <NumberField label="VIX riesgo medio ≤" value={draft.sentiment.vixMediumRiskMax}
          onChange={(v) => set((c) => { c.sentiment.vixMediumRiskMax = v; })} />
        <NumberField label="VIX riesgo alto >" value={draft.sentiment.vixHighRiskAbove}
          onChange={(v) => set((c) => { c.sentiment.vixHighRiskAbove = v; })} />
      </Section>

      <div className="flex flex-wrap gap-2">
        <button
          data-testid="scorecard-settings-save"
          onClick={() => void onSave()}
          disabled={saving || !weightsValid}
          className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          data-testid="scorecard-settings-saveas"
          onClick={() => void onSaveAsNew()}
          disabled={saving || !weightsValid}
          className="rounded border border-edge bg-panel-2 px-3 py-1 text-xs text-gray-200 hover:bg-panel-3 disabled:opacity-50"
        >
          Guardar como nuevo perfil
        </button>
        <button
          data-testid="scorecard-settings-reset"
          onClick={() => void onReset()}
          disabled={saving}
          className="rounded border border-edge bg-panel-2 px-3 py-1 text-xs text-gray-200 hover:bg-panel-3 disabled:opacity-50"
        >
          Restaurar default
        </button>
      </div>
    </div>
  );
}
