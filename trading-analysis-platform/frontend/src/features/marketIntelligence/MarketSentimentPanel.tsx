import { FearGreedGauge } from "./FearGreedGauge";
import type { SentimentDto } from "./marketIntelligenceTypes";

/** Panel de sentimiento de mercado (envuelve el gauge Fear & Greed). */
export function MarketSentimentPanel({ sentiment }: { sentiment: SentimentDto }) {
  return (
    <section data-testid="market-sentiment-panel">
      <FearGreedGauge sentiment={sentiment} />
    </section>
  );
}
