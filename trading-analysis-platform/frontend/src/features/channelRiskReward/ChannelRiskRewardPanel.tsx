import { useEffect, useMemo, useState } from "react";
import { useDrawingStore } from "@/stores/drawingStore";
import { useSymbolStore } from "@/stores/symbolStore";
import { useChartStore } from "@/stores/chartStore";
import { resolveDisplayPrice } from "@/features/charting/priceResolver";
import { useSimulatedTradesStore } from "@/features/simulatedTrades/simulatedTradesStore";
import { ChannelLineSelector } from "./ChannelLineSelector";
import { detectChannels } from "./channelAutoDetection";
import { computeChannelRiskReward } from "./channelRiskRewardMath";
import {
  channelSummaryText,
  drawingToChannelLine,
} from "./channelRiskRewardService";
import { useChannelRiskRewardStore } from "./channelRiskRewardStore";

/**
 * Panel "R/R de canal". El flujo PRINCIPAL es la AUTO-DETECCION: el sistema
 * busca pares de lineas ~paralelas entre tus dibujos, decide cual es superior
 * e inferior por precio, y calcula el R/R hipotetico. La seleccion manual
 * queda como respaldo (colapsada). No es asesoria financiera.
 */
export function ChannelRiskRewardPanel() {
  const symbol = useSymbolStore((s) => s.activeSymbol);
  const drawingsBySymbol = useDrawingStore((s) => s.drawingsBySymbol);
  const upperDrawingId = useChannelRiskRewardStore((s) => s.upperDrawingId);
  const lowerDrawingId = useChannelRiskRewardStore((s) => s.lowerDrawingId);
  const referenceType = useChannelRiskRewardStore((s) => s.referenceType);
  const manualOverride = useChannelRiskRewardStore((s) => s.manualOverride);
  const setUpper = useChannelRiskRewardStore((s) => s.setUpper);
  const setLower = useChannelRiskRewardStore((s) => s.setLower);
  const swap = useChannelRiskRewardStore((s) => s.swap);
  const setReferenceType = useChannelRiskRewardStore((s) => s.setReferenceType);
  const setResult = useChannelRiskRewardStore((s) => s.setResult);
  const setAutoDetection = useChannelRiskRewardStore((s) => s.setAutoDetection);
  const setManualOverride = useChannelRiskRewardStore((s) => s.setManualOverride);

  const quote = useChartStore((s) => (symbol ? s.quoteBySymbol[symbol] : undefined));
  const chartDataByPreset = useChartStore((s) => s.chartDataByPreset);
  const currentPrice = resolveDisplayPrice(quote, chartDataByPreset).price;
  const simTrades = useSimulatedTradesStore((s) =>
    symbol ? s.tradesBySymbol[symbol] ?? [] : []
  );
  const [copied, setCopied] = useState(false);

  const symbolDrawings = useMemo(
    () => (symbol ? drawingsBySymbol[symbol] ?? [] : []),
    [symbol, drawingsBySymbol]
  );
  const freeLines = useMemo(
    () =>
      symbolDrawings.filter(
        (d) =>
          (d.type === "free_line" || d.type === "extended_trendline" || d.type === "dotted_line") &&
          d.visible !== false &&
          d.points.length >= 2
      ),
    [symbolDrawings]
  );

  const openEntry = simTrades.find((t) => t.status === "ABIERTA" && t.visible);

  // Referencia: precio actual (default) o entrada simulada abierta.
  const useSimEntry = referenceType === "simulated_entry" && openEntry;
  const referencePrice = useSimEntry ? openEntry.entryPrice : currentPrice;
  const targetTimeMs = useSimEntry
    ? new Date(openEntry.entryDate).getTime()
    : Date.now();

  // ---- AUTO-DETECCION (flujo principal) ----
  const auto = useMemo(() => {
    if (referencePrice == null || freeLines.length < 2) {
      return { best: null, alternates: [] as never[] };
    }
    return detectChannels(freeLines, referencePrice, targetTimeMs);
  }, [freeLines, referencePrice, targetTimeMs]);

  // ---- Manual (respaldo) ----
  const manualResult = useMemo(() => {
    if (!manualOverride || referencePrice == null) return null;
    const upperDrawing = freeLines.find((d) => d.id === upperDrawingId);
    const lowerDrawing = freeLines.find((d) => d.id === lowerDrawingId);
    if (!upperDrawing || !lowerDrawing) return null;
    const upper = drawingToChannelLine(upperDrawing);
    const lower = drawingToChannelLine(lowerDrawing);
    if (!upper || !lower) return null;
    return computeChannelRiskReward(
      upper,
      lower,
      referencePrice,
      targetTimeMs,
      useSimEntry ? "simulated_entry" : "current_price"
    );
  }, [manualOverride, freeLines, upperDrawingId, lowerDrawingId, referencePrice, targetTimeMs, useSimEntry]);

  // El resultado EFECTIVO (manual si hay override, si no el auto-detectado)
  // se publica para el badge de las graficas y los prompts de IA.
  const effective = manualOverride ? manualResult : (auto.best?.result ?? null);
  const effectiveWithRef = effective
    ? { ...effective, referenceType: useSimEntry ? ("simulated_entry" as const) : ("current_price" as const) }
    : null;

  useEffect(() => {
    setAutoDetection(auto.best, auto.alternates);
    setResult(effectiveWithRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.best, auto.alternates, effective?.ratio, effective?.referencePrice, manualOverride]);

  if (!symbol) return null;

  const copySummary = async () => {
    if (!effectiveWithRef) return;
    try {
      await navigator.clipboard.writeText(channelSummaryText(effectiveWithRef));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* el resumen tambien viaja solo en los prompts */
    }
  };

  const lineLabel = (drawingId: string): string => {
    const d = freeLines.find((x) => x.id === drawingId);
    if (!d) return drawingId.slice(0, 6);
    const [a, b] = d.points;
    return `${d.sourceTimeframe} ${a?.price.toFixed(2)} → ${b?.price.toFixed(2)}`;
  };

  const result = effectiveWithRef;

  return (
    <div data-testid="channel-rr-panel" className="border-t border-edge px-3 py-2">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        R/R de canal {manualOverride ? "(manual)" : "(auto)"}
      </p>

      {freeLines.length < 2 ? (
        <p data-testid="channel-rr-need-lines" className="text-[11px] text-muted">
          Dibuja dos líneas (Free Line / trendline) formando un canal: se
          detectará automáticamente.
        </p>
      ) : !manualOverride && !auto.best ? (
        <p data-testid="channel-rr-none" className="text-[11px] text-muted">
          No se detectó un canal válido entre tus líneas (¿paralelas y con el
          precio dentro?). Usa la selección manual si lo prefieres.
        </p>
      ) : null}

      {/* Canal auto-detectado */}
      {!manualOverride && auto.best && (
        <div
          data-testid="channel-auto-section"
          className="rounded border border-edge bg-panel-2 p-2 text-[11px]"
        >
          <div className="flex justify-between text-gray-300">
            <span>Superior</span>
            <span className="font-mono">{lineLabel(auto.best.upper.drawingId)}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Inferior</span>
            <span className="font-mono">{lineLabel(auto.best.lower.drawingId)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Confianza</span>
            <span className="font-mono">{(auto.best.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Resultado (auto o manual) */}
      {result && (
        <div
          data-testid="channel-rr-result"
          className="mt-2 rounded border border-edge bg-panel-2 p-2 text-[11px]"
        >
          <div className="flex justify-between text-gray-300">
            <span>Referencia {useSimEntry ? "(sim entry)" : "(precio actual)"}</span>
            <span className="font-mono">{result.referencePrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Canal superior</span>
            <span className="font-mono">{result.upperChannelPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Canal inferior</span>
            <span className="font-mono">{result.lowerChannelPrice.toFixed(2)}</span>
          </div>
          {result.invalidReason ? (
            <p className="mt-1 rounded bg-amber-500/10 px-1.5 py-1 text-amber-300">
              {result.invalidReason}
            </p>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-muted">Beneficio potencial</span>
                <span className="font-mono text-up">
                  +{result.potentialRewardPercent?.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Riesgo potencial</span>
                <span className="font-mono text-down">
                  -{result.potentialRiskPercent?.toFixed(2)}%
                </span>
              </div>
              <div className="mt-0.5 flex justify-between border-t border-edge pt-0.5">
                <span className="font-semibold text-gray-100">Ratio</span>
                <span
                  data-testid="channel-rr-ratio"
                  className="font-mono font-semibold text-gray-100"
                >
                  {result.ratio?.toFixed(2)} : 1
                </span>
              </div>
            </>
          )}
          <button
            onClick={() => void copySummary()}
            data-testid="channel-copy-summary"
            className="mt-1.5 w-full rounded bg-panel-3 px-2 py-1 text-[11px] text-gray-200 hover:bg-edge"
          >
            {copied ? "✓ Copiado" : "📋 Copiar resumen"}
          </button>
        </div>
      )}

      {/* Referencia */}
      {freeLines.length >= 2 && (
        <select
          value={referenceType}
          onChange={(e) =>
            setReferenceType(e.target.value as "current_price" | "simulated_entry")
          }
          data-testid="channel-reference"
          className="mt-1.5 w-full rounded border border-edge bg-panel-2 px-2 py-1 text-[11px] text-gray-100"
        >
          <option value="current_price">Referencia: precio actual</option>
          <option value="simulated_entry" disabled={!openEntry}>
            Referencia: entrada simulada{openEntry ? ` @ ${openEntry.entryPrice.toFixed(2)}` : " (no hay)"}
          </option>
        </select>
      )}

      {/* Override manual (respaldo, colapsado por defecto) */}
      {freeLines.length >= 2 && (
        <details className="mt-1.5" open={manualOverride}>
          <summary
            data-testid="channel-manual-toggle"
            className="cursor-pointer text-[10px] text-muted hover:text-gray-300"
            onClick={(e) => {
              e.preventDefault();
              setManualOverride(!manualOverride);
            }}
          >
            Selección manual {manualOverride ? "(activa)" : ""}
          </summary>
          {manualOverride && (
            <div className="mt-1.5 space-y-1.5">
              <ChannelLineSelector
                label="Canal superior"
                freeLines={freeLines}
                value={upperDrawingId}
                exclude={lowerDrawingId}
                onChange={setUpper}
                testId="channel-upper-select"
              />
              <ChannelLineSelector
                label="Canal inferior"
                freeLines={freeLines}
                value={lowerDrawingId}
                exclude={upperDrawingId}
                onChange={setLower}
                testId="channel-lower-select"
              />
              <button
                onClick={swap}
                data-testid="channel-swap"
                className="rounded border border-edge bg-panel-2 px-2 py-0.5 text-[11px] text-gray-200 hover:bg-panel-3"
              >
                ⇅ Intercambiar
              </button>
            </div>
          )}
        </details>
      )}

      <p className="mt-1 text-[9px] text-muted">
        Cálculo hipotético sobre tus dibujos; no es asesoría financiera.
      </p>
    </div>
  );
}
