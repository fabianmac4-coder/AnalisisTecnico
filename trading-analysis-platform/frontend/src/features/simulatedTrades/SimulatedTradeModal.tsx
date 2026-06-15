import { useState } from "react";
import { useChartStore } from "@/stores/chartStore";
import { useSymbolStore } from "@/stores/symbolStore";
import { resolveDisplayPriceFromSlots } from "@/features/charting/priceResolver";
import { useStockScorecardStore, selectScorecard } from "@/features/stockScorecard/stockScorecardStore";
import { useChannelRiskRewardStore } from "@/features/channelRiskReward/channelRiskRewardStore";
import { OVERALL_VIEW_LABEL } from "@/features/stockScorecard/stockScorecardTypes";
import { useSimulatedTradesStore } from "./simulatedTradesStore";
import { captureAnalysisSnapshot } from "./simEntrySnapshot";
import type { SimulatedTradeType } from "./simulatedTradesTypes";

/**
 * Modal de nueva entrada simulada (paper trading). Captura precio + tesis y
 * guarda un SNAPSHOT del análisis (scorecard, Channel R/R, workspace) para poder
 * revisarlo después. NO ejecuta órdenes reales.
 */
export function SimulatedTradeModal() {
  const modalOpen = useSimulatedTradesStore((s) => s.modalOpen);
  const closeModal = useSimulatedTradesStore((s) => s.closeModal);
  const createTrade = useSimulatedTradesStore((s) => s.create);
  const error = useSimulatedTradesStore((s) => s.error);

  const symbol = useSymbolStore((s) => s.activeSymbol);
  const quote = useChartStore((s) => (symbol ? s.quoteBySymbol[symbol] : undefined));
  const chartDataBySlot = useChartStore((s) => s.chartDataBySlot);
  const canonicalPrice = resolveDisplayPriceFromSlots(quote, Object.values(chartDataBySlot));
  const scorecard = useStockScorecardStore((s) => selectScorecard(s, symbol));
  const channelResult = useChannelRiskRewardStore((s) => s.result);

  const [price, setPrice] = useState<string>("");
  const [type, setType] = useState<SimulatedTradeType>("LONG");
  const [quantity, setQuantity] = useState<string>("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState("#22c55e");
  const [thesis, setThesis] = useState("");
  const [bullish, setBullish] = useState("");
  const [bearish, setBearish] = useState("");
  const [invalidation, setInvalidation] = useState("");
  const [target, setTarget] = useState("");
  const [showThesis, setShowThesis] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  if (!modalOpen || !symbol) return null;

  const effectivePrice = touched ? price : (canonicalPrice?.toFixed(2) ?? "");
  const parsedPrice = Number(effectivePrice);
  const priceValid = Number.isFinite(parsedPrice) && parsedPrice > 0;

  const reset = () => {
    setPrice(""); setTouched(false); setQuantity(""); setName(""); setNotes("");
    setThesis(""); setBullish(""); setBearish(""); setInvalidation(""); setTarget("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceValid) return;
    setSaving(true);
    const snap = captureAnalysisSnapshot(symbol);
    const ok = await createTrade({
      symbol,
      c030Id: snap.c030Id ?? null,
      type,
      entryPrice: parsedPrice,
      quantity: quantity ? Number(quantity) : null,
      entryDate: new Date().toISOString(),
      sourceTimeframe: snap.sourceTimeframe,
      name: name.trim() || null,
      notes: notes.trim() || null,
      color,
      entryThesis: thesis.trim() || null,
      bullishScenario: bullish.trim() || null,
      bearishScenario: bearish.trim() || null,
      invalidationLevel: invalidation.trim() || null,
      targetArea: target.trim() || null,
      metadata: snap.metadata,
      analysisSnapshot: snap.analysisSnapshot,
    });
    setSaving(false);
    if (ok) reset();
  };

  const inputClass =
    "mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={submit}
        data-testid="sim-entry-modal"
        className="max-h-[90vh] w-[28rem] overflow-auto rounded-lg border border-edge bg-panel p-5"
      >
        <h2 className="mb-1 text-sm font-bold text-gray-100">
          Entrada simulada en {symbol}
        </h2>
        <p className="mb-3 text-[11px] text-muted">
          Paper trading hipotético: no ejecuta ninguna orden real.
        </p>

        {/* Vista previa del contexto que se guardará. */}
        {(scorecard || channelResult) && (
          <div
            data-testid="sim-entry-preview"
            className="mb-3 space-y-0.5 rounded border border-edge bg-panel-2 p-2 text-[11px] text-gray-300"
          >
            <p className="text-[10px] font-semibold uppercase text-muted">
              Contexto a guardar
            </p>
            {scorecard && (
              <p>
                Scorecard: {scorecard.overallScore ?? "n/d"} ·{" "}
                {OVERALL_VIEW_LABEL[scorecard.overallView]}
              </p>
            )}
            {channelResult && !channelResult.invalidReason && (
              <p>Canal R/R: {channelResult.ratio?.toFixed(2)} : 1</p>
            )}
          </div>
        )}

        <div className="mb-3 flex gap-2">
          <label className="flex-1 text-xs text-muted">
            Precio de entrada
            <input
              value={effectivePrice}
              onChange={(e) => { setTouched(true); setPrice(e.target.value); }}
              inputMode="decimal"
              data-testid="sim-entry-price"
              className={inputClass}
            />
          </label>
          <label className="w-28 text-xs text-muted">
            Tipo
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SimulatedTradeType)}
              className={inputClass}
            >
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
          </label>
        </div>

        <div className="mb-3 flex gap-2">
          <label className="flex-1 text-xs text-muted">
            Cantidad (opcional)
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
              placeholder="p. ej. 10"
              className={inputClass}
            />
          </label>
          <label className="w-28 text-xs text-muted">
            Color
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-1 h-9 w-full cursor-pointer rounded border border-edge bg-panel-2"
            />
          </label>
        </div>

        <label className="mb-3 block text-xs text-muted">
          Nombre (opcional)
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. Prueba en soporte"
            className={inputClass}
          />
        </label>
        <label className="mb-3 block text-xs text-muted">
          Notas (opcional)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
        </label>

        {/* Tesis y escenarios (se guardan en el snapshot de análisis). */}
        <button
          type="button"
          data-testid="sim-entry-thesis-toggle"
          onClick={() => setShowThesis((v) => !v)}
          className="mb-2 text-[11px] text-accent hover:underline"
        >
          {showThesis ? "▾" : "▸"} Tesis y escenarios (opcional)
        </button>
        {showThesis && (
          <div className="mb-3 space-y-2" data-testid="sim-entry-thesis">
            <label className="block text-xs text-muted">
              Tesis de la entrada
              <input value={thesis} onChange={(e) => setThesis(e.target.value)}
                placeholder="p. ej. Retest de breakout" className={inputClass} />
            </label>
            <label className="block text-xs text-muted">
              Escenario alcista
              <input value={bullish} onChange={(e) => setBullish(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-xs text-muted">
              Escenario bajista
              <input value={bearish} onChange={(e) => setBearish(e.target.value)} className={inputClass} />
            </label>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-muted">
                Invalidación
                <input value={invalidation} onChange={(e) => setInvalidation(e.target.value)}
                  placeholder="p. ej. 176.00" className={inputClass} />
              </label>
              <label className="flex-1 text-xs text-muted">
                Objetivo
                <input value={target} onChange={(e) => setTarget(e.target.value)}
                  placeholder="p. ej. 210.00" className={inputClass} />
              </label>
            </div>
          </div>
        )}

        {error && (
          <p className="mb-3 rounded bg-red-500/10 px-2 py-1.5 text-xs text-down">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeModal}
            className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !priceValid}
            data-testid="sim-entry-save"
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar entrada con análisis"}
          </button>
        </div>
      </form>
    </div>
  );
}
