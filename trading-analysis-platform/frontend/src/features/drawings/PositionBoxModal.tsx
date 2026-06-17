import { useEffect, useMemo, useState } from "react";
import { useDrawingStore } from "@/stores/drawingStore";
import { useSimulatedTradesStore } from "@/features/simulatedTrades/simulatedTradesStore";
import { useToastStore } from "@/components/ui/toastStore";
import { usePositionBoxStore } from "./positionBoxStore";
import { calcPositionBox } from "./positionBoxCalculations";
import type { Drawing, PositionBoxType } from "./drawingTypes";

/** Busca un dibujo por id en cualquier símbolo cargado en el store. */
function useDrawingById(id: string | null): Drawing | null {
  const bySymbol = useDrawingStore((s) => s.drawingsBySymbol);
  return useMemo(() => {
    if (!id) return null;
    for (const list of Object.values(bySymbol)) {
      const found = list.find((d) => d.id === id);
      if (found) return found;
    }
    return null;
  }, [id, bySymbol]);
}

/**
 * Modal de edición de una caja de PLAN de posición (Long/Short). Edita
 * entrada/objetivo/stop/cantidad/fees/notas con cálculo en vivo de
 * riesgo/recompensa. NO es una entrada simulada (C050) salvo conversión
 * explícita con el botón "Crear entrada simulada".
 */
export function PositionBoxModal() {
  const editingId = usePositionBoxStore((s) => s.editingId);
  const closeEdit = usePositionBoxStore((s) => s.closeEdit);
  const updateDrawing = useDrawingStore((s) => s.updateDrawing);
  const removeDrawing = useDrawingStore((s) => s.removeDrawing);
  const createTrade = useSimulatedTradesStore((s) => s.create);
  const toast = useToastStore((s) => s.show);

  const drawing = useDrawingById(editingId);

  const [type, setType] = useState<PositionBoxType>("LONG_POSITION");
  const [entry, setEntry] = useState("");
  const [target, setTarget] = useState("");
  const [stop, setStop] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [fees, setFees] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Carga los valores del dibujo cuando se abre.
  useEffect(() => {
    if (!drawing) return;
    setType(drawing.type as PositionBoxType);
    setEntry(String(drawing.points[0]?.price ?? ""));
    setTarget(String(drawing.points[1]?.price ?? ""));
    setStop(String(drawing.points[2]?.price ?? ""));
    setQuantity(String(drawing.style.position?.quantity ?? 1));
    setFees(String(drawing.style.position?.fees ?? 0));
    setNotes(drawing.style.position?.notes ?? "");
  }, [drawing]);

  if (!editingId || !drawing) return null;

  const entryN = Number(entry);
  const targetN = Number(target);
  const stopN = Number(stop);
  const qtyN = Number(quantity);
  const feesN = Number(fees) || 0;

  const metrics = calcPositionBox({
    type,
    entryPrice: entryN,
    targetPrice: targetN,
    stopPrice: stopN,
    quantity: qtyN,
    fees: feesN,
  });

  const currency = drawing.style.position?.accountCurrency ?? "USD";

  const save = async () => {
    setSaving(true);
    const points = [
      { time: drawing.points[0].time, price: entryN },
      { time: drawing.points[1].time, price: targetN },
      { time: drawing.points[2].time, price: stopN },
    ];
    await updateDrawing({
      ...drawing,
      type,
      points,
      style: {
        ...drawing.style,
        position: {
          ...(drawing.style.position ?? { toolType: type, quantity: 1 }),
          toolType: type,
          quantity: qtyN > 0 ? qtyN : 1,
          fees: feesN,
          notes: notes.trim() || undefined,
        },
      },
    });
    setSaving(false);
    closeEdit();
  };

  const onDelete = async () => {
    if (!window.confirm("¿Eliminar este plan de posición?")) return;
    await removeDrawing(drawing.id);
    closeEdit();
  };

  const toggleLock = async () => {
    await updateDrawing({ ...drawing, locked: !drawing.locked });
  };

  // Conversión OPCIONAL a entrada simulada (C050). El plan (C0101) NO se borra.
  const convertToSimEntry = async () => {
    const pos = drawing.style.position;
    const ok = await createTrade({
      symbol: drawing.symbol,
      c030Id: drawing.c030Id ?? null,
      type: type === "LONG_POSITION" ? "LONG" : "SHORT",
      entryPrice: entryN,
      quantity: qtyN > 0 ? qtyN : null,
      entryDate: new Date(drawing.points[0].time).toISOString(),
      sourceTimeframe: drawing.sourceTimeframe,
      name: type === "LONG_POSITION" ? "Plan de posición Long" : "Plan de posición Short",
      notes: notes.trim() || null,
      metadata: {
        sourceDrawingC0101Id: drawing.id,
        targetPrice: targetN,
        stopPrice: stopN,
        riskRewardRatio: metrics.riskRewardRatio,
        riskAmount: metrics.riskAmount,
        rewardAmount: metrics.rewardAmount,
        chartSlotId: pos?.chartSlotId,
        chartRange: pos?.chartRange,
        chartInterval: pos?.chartInterval,
        chartContextKey: pos?.chartContextKey ?? drawing.sourceTimeframe,
      },
    });
    if (ok) {
      toast("Entrada simulada creada desde el plan.", "success");
      closeEdit();
    } else {
      toast("No se pudo crear la entrada simulada.", "error");
    }
  };

  const inputClass =
    "mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none";
  const rr = metrics.riskRewardRatio != null ? `${metrics.riskRewardRatio.toFixed(2)} : 1` : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        data-testid="position-box-modal"
        className="max-h-[90vh] w-[26rem] overflow-auto rounded-lg border border-edge bg-panel p-5"
      >
        <h2 className="mb-1 text-sm font-bold text-gray-100">
          Plan de posición en {drawing.symbol}
        </h2>
        <p className="mb-3 text-[11px] text-muted">
          Herramienta de planificación (riesgo/beneficio). No ejecuta órdenes ni es una entrada
          simulada.
        </p>

        <div className="mb-3 flex gap-2">
          <label className="flex-1 text-xs text-muted">
            Tipo
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PositionBoxType)}
              data-testid="position-box-type"
              className={inputClass}
            >
              <option value="LONG_POSITION">Long</option>
              <option value="SHORT_POSITION">Short</option>
            </select>
          </label>
          <label className="flex-1 text-xs text-muted">
            Cantidad
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
              data-testid="position-box-quantity"
              className={inputClass}
            />
          </label>
        </div>

        <div className="mb-3 flex gap-2">
          <label className="flex-1 text-xs text-muted">
            Entrada
            <input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal"
              data-testid="position-box-entry" className={inputClass} />
          </label>
          <label className="flex-1 text-xs text-muted">
            Fees
            <input value={fees} onChange={(e) => setFees(e.target.value)} inputMode="decimal"
              className={inputClass} />
          </label>
        </div>

        <div className="mb-3 flex gap-2">
          <label className="flex-1 text-xs text-muted">
            Objetivo (TP)
            <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal"
              data-testid="position-box-target" className={inputClass} />
          </label>
          <label className="flex-1 text-xs text-muted">
            Stop (SL)
            <input value={stop} onChange={(e) => setStop(e.target.value)} inputMode="decimal"
              data-testid="position-box-stop" className={inputClass} />
          </label>
        </div>

        <label className="mb-3 block text-xs text-muted">
          Notas
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className={inputClass} />
        </label>

        {/* Cálculo en vivo. */}
        <div
          data-testid="position-box-metrics"
          className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 rounded border border-edge bg-panel-2 p-3 text-[11px]"
        >
          <span className="text-muted">Riesgo/Beneficio</span>
          <span className="text-right font-semibold text-gray-100" data-testid="position-box-rr">{rr}</span>
          <span className="text-muted">Riesgo %</span>
          <span className="text-right text-rose-400">{metrics.riskPercent.toFixed(2)}%</span>
          <span className="text-muted">Beneficio %</span>
          <span className="text-right text-emerald-400">{metrics.rewardPercent.toFixed(2)}%</span>
          <span className="text-muted">Riesgo {currency}</span>
          <span className="text-right text-rose-400">{metrics.riskAmount.toFixed(2)}</span>
          <span className="text-muted">Beneficio {currency}</span>
          <span className="text-right text-emerald-400">{metrics.rewardAmount.toFixed(2)}</span>
          <span className="text-muted">P&L objetivo</span>
          <span className="text-right text-emerald-400">{metrics.targetPnL.toFixed(2)}</span>
          <span className="text-muted">P&L stop</span>
          <span className="text-right text-rose-400">{metrics.stopPnL.toFixed(2)}</span>
        </div>

        {!metrics.isValid && (
          <p className="mb-3 rounded bg-amber-500/10 px-2 py-1.5 text-xs text-amber-400"
            data-testid="position-box-warning">
            ⚠ {metrics.validationMessage}
          </p>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            <button type="button" onClick={onDelete}
              className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-down hover:bg-panel-3">
              Eliminar
            </button>
            <button type="button" onClick={toggleLock}
              className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3">
              {drawing.locked ? "🔓 Desbloquear" : "🔒 Bloquear"}
            </button>
            <button type="button" onClick={convertToSimEntry} disabled={!metrics.isValid}
              data-testid="position-box-convert"
              className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3 disabled:opacity-50">
              Crear entrada simulada
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={closeEdit}
              className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3">
              Cancelar
            </button>
            <button type="button" onClick={save} disabled={saving}
              data-testid="position-box-save"
              className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
