import { useEffect, useMemo, useState } from "react";
import { useDrawingStore } from "@/stores/drawingStore";
import { useSymbolStore } from "@/stores/symbolStore";
import { useChartStore } from "@/stores/chartStore";
import { resolveDisplayPrice } from "@/features/charting/priceResolver";
import { useSimulatedTradesStore } from "@/features/simulatedTrades/simulatedTradesStore";
import { normalizeChartTimeToMs } from "@/features/drawings/timeConversion";
import { PRESET_KEYS, type PresetKey } from "@/utils/timeframes";
import { ChannelLineSelector } from "./ChannelLineSelector";
import { detectChannels, type DetectedChannel } from "./channelAutoDetection";
import { computeChannelRiskReward } from "./channelRiskRewardMath";
import {
  channelSummaryText,
  drawingToChannelLine,
} from "./channelRiskRewardService";
import { useChannelRiskRewardStore } from "./channelRiskRewardStore";

/**
 * Panel "R/R de canal". El flujo PRINCIPAL es la AUTO-DETECCION POR
 * TEMPORALIDAD: cada panel del dashboard detecta canales SOLO entre lineas
 * cuyo sourceTimeframe coincide con su preset (un canal de 4Y_1W no calcula
 * en 1Y_1D ni al reves). Este panel izquierdo muestra el canal de la grafica
 * ACTIVA (ultimo panel clickeado; si no hay, el mejor disponible). La
 * seleccion manual queda como respaldo (colapsada) y SI permite mezclar
 * lineas de cualquier temporalidad visible. No es asesoria financiera.
 */
export function ChannelRiskRewardPanel() {
  const symbol = useSymbolStore((s) => s.activeSymbol);
  const drawingsBySymbol = useDrawingStore((s) => s.drawingsBySymbol);
  const upperDrawingId = useChannelRiskRewardStore((s) => s.upperDrawingId);
  const lowerDrawingId = useChannelRiskRewardStore((s) => s.lowerDrawingId);
  const referenceType = useChannelRiskRewardStore((s) => s.referenceType);
  const manualOverride = useChannelRiskRewardStore((s) => s.manualOverride);
  const activeChartPreset = useChannelRiskRewardStore((s) => s.activeChartPreset);
  const setUpper = useChannelRiskRewardStore((s) => s.setUpper);
  const setLower = useChannelRiskRewardStore((s) => s.setLower);
  const swap = useChannelRiskRewardStore((s) => s.swap);
  const setReferenceType = useChannelRiskRewardStore((s) => s.setReferenceType);
  const setResult = useChannelRiskRewardStore((s) => s.setResult);
  const setAutoByTimeframe = useChannelRiskRewardStore((s) => s.setAutoByTimeframe);
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
  const useSimEntry = referenceType === "simulated_entry" && openEntry;

  // ---- AUTO-DETECCION POR TEMPORALIDAD (flujo principal) ----
  // Referencia: precio canonico actual. Tiempo de referencia: la ULTIMA VELA
  // REAL de cada panel (no el reloj), normalizada a ms por si acaso.
  const autoByTimeframe = useMemo(() => {
    const map: Partial<Record<PresetKey, DetectedChannel | null>> = {};
    for (const preset of PRESET_KEYS) {
      const bars = chartDataByPreset[preset]?.bars;
      const lastBar = bars && bars.length > 0 ? bars[bars.length - 1] : null;
      if (currentPrice == null || !lastBar || freeLines.length < 2) {
        map[preset] = null;
        continue;
      }
      const targetTimeMs = normalizeChartTimeToMs(lastBar.time);
      map[preset] = detectChannels(freeLines, currentPrice, targetTimeMs, {
        timeframe: preset,
      }).best;
    }
    return map;
  }, [freeLines, currentPrice, chartDataByPreset]);

  // Temporalidad mostrada: la grafica ACTIVA (click) o, si el usuario aun no
  // enfoco ninguna, la del canal con mayor confianza.
  const shownPreset: PresetKey | null = useMemo(() => {
    if (activeChartPreset) return activeChartPreset;
    let bestKey: PresetKey | null = null;
    let bestConf = -1;
    for (const preset of PRESET_KEYS) {
      const c = autoByTimeframe[preset];
      if (c && c.confidence > bestConf) {
        bestConf = c.confidence;
        bestKey = preset;
      }
    }
    return bestKey;
  }, [activeChartPreset, autoByTimeframe]);

  const activeAuto = shownPreset ? autoByTimeframe[shownPreset] ?? null : null;

  // Con referencia "entrada simulada", el R/R del canal activo se recalcula
  // sobre el precio/fecha de la entrada (los badges siguen con precio actual).
  const activeAutoResult = useMemo(() => {
    if (!activeAuto) return null;
    if (!useSimEntry) return activeAuto.result;
    return computeChannelRiskReward(
      activeAuto.upper,
      activeAuto.lower,
      useSimEntry.entryPrice,
      new Date(useSimEntry.entryDate).getTime(),
      "simulated_entry"
    );
  }, [activeAuto, useSimEntry]);

  // ---- Manual (respaldo; puede mezclar lineas de cualquier temporalidad) ----
  const manualReferencePrice = useSimEntry ? useSimEntry.entryPrice : currentPrice;
  const manualTargetTimeMs = useSimEntry
    ? new Date(useSimEntry.entryDate).getTime()
    : Date.now();
  const manualResult = useMemo(() => {
    if (!manualOverride || manualReferencePrice == null) return null;
    const upperDrawing = freeLines.find((d) => d.id === upperDrawingId);
    const lowerDrawing = freeLines.find((d) => d.id === lowerDrawingId);
    if (!upperDrawing || !lowerDrawing) return null;
    const upper = drawingToChannelLine(upperDrawing);
    const lower = drawingToChannelLine(lowerDrawing);
    if (!upper || !lower) return null;
    return computeChannelRiskReward(
      upper,
      lower,
      manualReferencePrice,
      manualTargetTimeMs,
      useSimEntry ? "simulated_entry" : "current_price"
    );
  }, [manualOverride, freeLines, upperDrawingId, lowerDrawingId, manualReferencePrice, manualTargetTimeMs, useSimEntry]);

  // El resultado EFECTIVO (manual si hay override; si no, el canal auto de la
  // temporalidad activa) se publica para los prompts de IA.
  const effective = manualOverride ? manualResult : activeAutoResult;
  const effectiveWithRef = effective
    ? { ...effective, referenceType: useSimEntry ? ("simulated_entry" as const) : ("current_price" as const) }
    : null;

  useEffect(() => {
    setAutoByTimeframe(autoByTimeframe);
    setAutoDetection(activeAuto, []);
    setResult(effectiveWithRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoByTimeframe, activeAuto, effective?.ratio, effective?.referencePrice, effective?.invalidReason, manualOverride]);

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

      {/* Temporalidad activa: el panel sigue a la grafica enfocada (click). */}
      {!manualOverride && freeLines.length >= 2 && shownPreset && (
        <p data-testid="channel-auto-timeframe" className="mb-1 text-[11px] text-gray-300">
          Canal auto: <span className="font-mono">{shownPreset}</span>
          {!activeChartPreset && (
            <span className="text-muted"> (mejor disponible; clickea una gráfica)</span>
          )}
        </p>
      )}

      {freeLines.length < 2 ? (
        <p data-testid="channel-rr-need-lines" className="text-[11px] text-muted">
          Dibuja dos líneas (Free Line / trendline) formando un canal: se
          detectará automáticamente en la temporalidad donde las dibujes.
        </p>
      ) : !manualOverride && !activeAuto ? (
        <p data-testid="channel-rr-none" className="text-[11px] text-muted">
          {shownPreset
            ? `Sin canal auto-detectado en ${shownPreset}. Dibuja dos líneas ~paralelas en esa gráfica o usa la selección manual.`
            : "Sin canal auto-detectado todavía. Dibuja dos líneas ~paralelas en una gráfica o usa la selección manual."}
        </p>
      ) : null}

      {/* Canal auto-detectado (de la temporalidad activa) */}
      {!manualOverride && activeAuto && (
        <div
          data-testid="channel-auto-section"
          className="rounded border border-edge bg-panel-2 p-2 text-[11px]"
        >
          <div className="flex justify-between text-gray-300">
            <span>Superior</span>
            <span className="font-mono">{lineLabel(activeAuto.upper.drawingId)}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Inferior</span>
            <span className="font-mono">{lineLabel(activeAuto.lower.drawingId)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Confianza</span>
            <span className="font-mono">{(activeAuto.confidence * 100).toFixed(0)}%</span>
          </div>
          {activeAuto.note && (
            <p data-testid="channel-rr-note" className="mt-1 text-[10px] text-amber-300/80">
              {activeAuto.note}
            </p>
          )}
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

      {/* Override manual (respaldo, colapsado por defecto). A diferencia del
          auto, aqui el usuario puede mezclar lineas de cualquier temporalidad. */}
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
            Selección manual (respaldo) {manualOverride ? "(activa)" : ""}
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
