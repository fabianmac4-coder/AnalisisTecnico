import { useChannelRiskRewardStore } from "./channelRiskRewardStore";

interface Props {
  /** Temporalidad del panel: el badge SOLO muestra el canal auto-detectado
   *  con lineas de ESTA temporalidad (TemporalidadOrigen === preset). */
  preset: string;
}

/**
 * Badge compacto del R/R de canal AUTO-detectado, en la esquina superior
 * derecha de cada grafica. Cada panel calcula su propio canal: un canal
 * dibujado en 4Y_1W no aparece en 1Y_1D ni al reves. Sin canal valido para
 * esta temporalidad no se muestra nada (sin avisos ruidosos).
 */
export function ChannelRiskRewardBadge({ preset }: Props) {
  const detected = useChannelRiskRewardStore((s) => s.autoByTimeframe[preset]);

  if (!detected) return null;
  const { result, confidence, note } = detected;
  if (result.invalidReason || result.ratio == null) return null;

  const title = [
    `Canal auto-detectado en ${preset} (confianza ${(confidence * 100).toFixed(0)}%)`,
    `Superior: ${result.upperChannelPrice.toFixed(2)}`,
    `Inferior: ${result.lowerChannelPrice.toFixed(2)}`,
    `Ref: ${result.referencePrice.toFixed(2)}`,
    `Beneficio: +${result.potentialRewardPercent?.toFixed(2)}%`,
    `Riesgo: -${result.potentialRiskPercent?.toFixed(2)}%`,
    ...(note ? [note] : []),
    "Análisis hipotético, no asesoría financiera",
  ].join("\n");

  return (
    <div
      data-testid="channel-rr-badge"
      data-preset={preset}
      title={title}
      className="pointer-events-auto absolute right-2 top-2 z-30 rounded border border-edge bg-panel/90 px-2 py-0.5 font-mono text-[10px] text-gray-200 shadow"
    >
      Canal R/R {result.ratio.toFixed(2)} : 1
    </div>
  );
}
