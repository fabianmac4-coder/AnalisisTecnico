import { useState } from "react";
import { usePortfolioStore } from "./portfolioStore";

/** Modal de alta/edición de una posición del portafolio. */
export function PositionFormModal() {
  const open = usePortfolioStore((s) => s.positionModalOpen);
  const editing = usePortfolioStore((s) => s.editingPosition);
  const close = usePortfolioStore((s) => s.closePositionModal);
  const save = usePortfolioStore((s) => s.savePosition);
  const error = usePortfolioStore((s) => s.error);

  const [ticker, setTicker] = useState(editing?.ticker ?? "");
  const [quantity, setQuantity] = useState(editing ? String(editing.quantity) : "");
  const [averageCost, setAverageCost] = useState(editing ? String(editing.averageCost) : "");
  const [purchaseDate, setPurchaseDate] = useState(editing?.purchaseDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [sector, setSector] = useState(editing?.sector ?? "");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const qty = Number(quantity);
  const avg = Number(averageCost);
  const valid = ticker.trim() && Number.isFinite(qty) && qty > 0 && Number.isFinite(avg) && avg >= 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    const ok = await save({
      ticker: ticker.trim().toUpperCase(),
      quantity: qty,
      averageCost: avg,
      purchaseDate: purchaseDate ? new Date(purchaseDate).toISOString() : null,
      notes: notes.trim() || null,
      sector: sector.trim() || null,
    });
    setSaving(false);
    if (ok) {
      setTicker(""); setQuantity(""); setAverageCost(""); setPurchaseDate(""); setNotes("");
    }
  };

  const input = "mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={submit} data-testid="position-modal" className="w-[26rem] max-w-full rounded-lg border border-edge bg-panel p-5">
        <h2 className="mb-3 text-sm font-bold text-gray-100">
          {editing ? `Editar posición ${editing.ticker}` : "Agregar posición"}
        </h2>
        <div className="space-y-3">
          {!editing && (
            <label className="block text-xs text-muted">
              Ticker
              <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="AAPL" data-testid="position-ticker" className={input} />
            </label>
          )}
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-muted">
              Cantidad
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" data-testid="position-quantity" className={input} />
            </label>
            <label className="flex-1 text-xs text-muted">
              Costo promedio
              <input value={averageCost} onChange={(e) => setAverageCost(e.target.value)} inputMode="decimal" data-testid="position-avgcost" className={input} />
            </label>
          </div>
          <label className="block text-xs text-muted">
            Fecha de compra (opcional)
            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={input} />
          </label>
          <label className="block text-xs text-muted">
            Sector (opcional)
            <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Technology" className={input} />
          </label>
          <label className="block text-xs text-muted">
            Notas (opcional)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={input} />
          </label>
        </div>

        {error && <p className="mt-3 rounded bg-red-500/10 px-2 py-1.5 text-xs text-down">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3">
            Cancelar
          </button>
          <button type="submit" disabled={!valid || saving} data-testid="position-save" className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
