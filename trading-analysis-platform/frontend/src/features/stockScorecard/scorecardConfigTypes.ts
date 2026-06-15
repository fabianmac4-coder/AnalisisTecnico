// Configuración de puntuación del Stock Scorecard (espejo de dbo.C081). El
// backend siempre devuelve la config COMPLETA (fundida con el default), así que
// el frontend puede asumir estructura completa.

export interface ScorecardConfig {
  version: number;
  weights: {
    technical: number;
    fundamentals: number;
    news: number;
    sentiment: number;
  };
  technical: {
    rsi: { idealMin: number; idealMax: number; overbought: number; oversold: number };
    movingAverages: {
      priceAboveSma50Points: number;
      priceAboveSma200Points: number;
      sma50AboveSma200Points: number;
    };
    channelRiskReward: {
      excellentRatio: number;
      goodRatio: number;
      minimumAcceptableRatio: number;
    };
  };
  fundamentals: {
    peRatio: {
      excellentMax: number;
      goodMax: number;
      expensiveAbove: number;
      veryExpensiveAbove: number;
    };
    roe: { excellentMin: number; goodMin: number; weakBelow: number };
    roa: { excellentMin: number; goodMin: number; weakBelow: number };
    profitMargin: { excellentMin: number; goodMin: number; weakBelow: number };
    revenueGrowth: { excellentMin: number; goodMin: number; negativeBelow: number };
    debtToEquity: { excellentMax: number; goodMax: number; riskyAbove: number };
    currentRatio: { goodMin: number; weakBelow: number };
  };
  news: {
    positiveHeadlineBoost: number;
    negativeHeadlinePenalty: number;
    maxNewsAgeDays: number;
  };
  sentiment: {
    vixLowRiskMax: number;
    vixMediumRiskMax: number;
    vixHighRiskAbove: number;
  };
}

export interface ScorecardConfigEntry {
  c081Id: number;
  name: string;
  isDefault: boolean;
  configuration: ScorecardConfig;
  createdAt?: string;
  updatedAt?: string;
}

/** Default del frontend (mismo que `backend/app/services/scorecard_config.py`). */
export const DEFAULT_SCORECARD_CONFIG: ScorecardConfig = {
  version: 1,
  weights: { technical: 40, fundamentals: 30, news: 20, sentiment: 10 },
  technical: {
    rsi: { idealMin: 45, idealMax: 65, overbought: 75, oversold: 30 },
    movingAverages: {
      priceAboveSma50Points: 8,
      priceAboveSma200Points: 10,
      sma50AboveSma200Points: 12,
    },
    channelRiskReward: { excellentRatio: 3, goodRatio: 2, minimumAcceptableRatio: 1.5 },
  },
  fundamentals: {
    peRatio: { excellentMax: 10, goodMax: 20, expensiveAbove: 35, veryExpensiveAbove: 50 },
    roe: { excellentMin: 20, goodMin: 12, weakBelow: 5 },
    roa: { excellentMin: 10, goodMin: 5, weakBelow: 2 },
    profitMargin: { excellentMin: 20, goodMin: 10, weakBelow: 3 },
    revenueGrowth: { excellentMin: 15, goodMin: 5, negativeBelow: 0 },
    debtToEquity: { excellentMax: 30, goodMax: 80, riskyAbove: 150 },
    currentRatio: { goodMin: 1.5, weakBelow: 1.0 },
  },
  news: { positiveHeadlineBoost: 10, negativeHeadlinePenalty: 15, maxNewsAgeDays: 14 },
  sentiment: { vixLowRiskMax: 16, vixMediumRiskMax: 24, vixHighRiskAbove: 30 },
};

/** Copia profunda simple de una config (para editar sin mutar el store). */
export function cloneConfig(c: ScorecardConfig): ScorecardConfig {
  return JSON.parse(JSON.stringify(c)) as ScorecardConfig;
}
