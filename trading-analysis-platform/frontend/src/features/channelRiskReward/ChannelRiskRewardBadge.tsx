import { useChannelRiskRewardStore } from "./channelRiskRewardStore";

/**
 * Badge compacto del R/R de canal AUTO-detectado, en la esquina superior
 * derecha de cada grafica. No se muestra nada si no hay canal valido.
 */
export function ChannelRiskRewardBadge() {
  const result = useChannelRiskRewardStore((s) => s.result);
  const autoBest = useChannelRiskRewardStore((s) => s.autoBest);

  if (!result || result.invalidReason || result.ratio == null) return null;

  const title = [
    `Superior: ${result.upperChannelPrice.toFixed(2)}`,
    `Inferior: ${result.lowerChannelPrice.toFixed(2)}`,
    `Ref: ${result.referencePrice.toFixed(2)}`,
    `Beneficio: +${result.potentialRewardPercent?.toFixed(2)}%`,
    `Riesgo: -${result.potentialRiskPercent?.toFixed(2)}%`,
    autoBest ? `Canal auto-detectado (confianza ${(autoBest.confidence * 100).toFixed(0)}%)` : "Canal manual",
    "Análisis hipotético, no asesoría financiera",
  ].join("\n");

  return (
    <div
      data-testid="channel-rr-badge"
      title={title}
      className="pointer-events-auto absolute right-2 top-2 z-30 rounded border border-edge bg-panel/90 px-2 py-0.5 font-mono text-[10px] text-gray-200 shadow"
    >
      Canal R/R {result.ratio.toFixed(2)} : 1
    </div>
  );
}
