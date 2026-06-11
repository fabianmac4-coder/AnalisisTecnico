import { useState } from "react";
import { useChartStore } from "@/stores/chartStore";
import { useSymbolStore } from "@/stores/symbolStore";
import { resolveDisplayPrice } from "@/features/charting/priceResolver";
import { useSimulatedTradesStore } from "./simulatedTradesStore";
import type { SimulatedTradeType } from "./simulatedTradesTypes";

/**
 * Modal de nueva entrada simulada (paper trading). Se abre desde el boton
 * "Sim Entry" con el precio canonico actual prellenado (editable).
 * NO ejecuta ordenes reales: es seguimiento hipotetico.
 */
export function SimulatedTradeModal() {
  const modalOpen = useSimulatedTradesStore((s) => s.modalOpen);
  const closeModal = useSimulatedTradesStore((s) => s.closeModal);
  const createTrade = useSimulatedTradesStore((s) => s.create);
  const error = useSimulatedTradesStore((s) => s.error);

  const symbol = useSymbolStore((s) => s.activeSymbol);
  const quote = useChartStore((s) => (symbol ? s.quoteBySymbol[symbol] : undefined));
  const chartDataByPreset = useChartStore((s) => s.chartDataByPreset);
  const canonicalPrice = resolveDisplayPrice(quote, chartDataByPreset).price;

  const [price, setPrice] = useState<string>("");
  const [type, setType] = useState<SimulatedTradeType>("LONG");
  const [quantity, setQuantity] = useState<string>("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState("#22c55e");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  if (!modalOpen || !symbol) return null;

  // Precio prellenado con el canonico la primera vez que se abre.
  const effectivePrice = touched ? price : (canonicalPrice?.toFixed(2) ?? "");
  const parsedPrice = Number(effectivePrice);
  const priceValid = Number.isFinite(parsedPrice) && parsedPrice > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceValid) return;
    setSaving(true);
    const ok = await createTrade({
      symbol,
      type,
      entryPrice: parsedPrice,
      quantity: quantity ? Number(quantity) : null,
      entryDate: new Date().toISOString(),
      name: name.trim() || null,
      notes: notes.trim() || null,
      color,
    });
    setSaving(false);
    if (ok) {
      setPrice("");
      setTouched(false);
      setQuantity("");
      setName("");
      setNotes("");
    }
  };

  const inputClass =
    "mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={submit}
        data-testid="sim-entry-modal"
        className="w-96 rounded-lg border border-edge bg-panel p-5"
      >
        <h2 className="mb-1 text-sm font-bold text-gray-100">
          Entrada simulada en {symbol}
        </h2>
        <p className="mb-3 text-[11px] text-muted">
          Paper trading hipotético: no ejecuta ninguna orden real.
        </p>

        <div className="mb-3 flex gap-2">
          <label className="flex-1 text-xs text-muted">
            Precio de entrada
            <input
              value={effectivePrice}
              onChange={(e) => {
                setTouched(true);
                setPrice(e.target.value);
              }}
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
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </label>

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
            {saving ? "Guardando…" : "Guardar entrada"}
          </button>
        </div>
      </form>
    </div>
  );
}
