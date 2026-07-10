export type MarketQualityLabel = 'excellent' | 'good' | 'neutral' | 'avoid';

export interface MarketQualityConfig {
  excellent: { minConfidence: number; maxEce: number; minClv: number; minHistoricalRoi: number; minLiquidity: number };
  good: { minConfidence: number; maxEce: number; minClv: number; minHistoricalRoi: number; minLiquidity: number };
  neutral: { maxEce: number; minClv: number };
}

export const DEFAULT_MARKET_QUALITY_CONFIG: MarketQualityConfig = {
  excellent: { minConfidence: 80, maxEce: 0.02, minClv: 0.03, minHistoricalRoi: 5, minLiquidity: 7 },
  good: { minConfidence: 60, maxEce: 0.035, minClv: 0.01, minHistoricalRoi: 2, minLiquidity: 5 },
  neutral: { maxEce: 0.05, minClv: 0 },
};

export interface MarketQualityInput {
  confidence: number;
  ece: number;
  clv: number;
  historicalRoi: number;
  liquidity: number;
}

export function computeMarketQuality(input: MarketQualityInput, config: MarketQualityConfig = DEFAULT_MARKET_QUALITY_CONFIG): MarketQualityLabel {
  const { confidence, ece, clv, historicalRoi, liquidity } = input;
  if (confidence >= config.excellent.minConfidence && ece <= config.excellent.maxEce && clv >= config.excellent.minClv && historicalRoi >= config.excellent.minHistoricalRoi && liquidity >= config.excellent.minLiquidity) return 'excellent';
  if (confidence >= config.good.minConfidence && ece <= config.good.maxEce && clv >= config.good.minClv && historicalRoi >= config.good.minHistoricalRoi && liquidity >= config.good.minLiquidity) return 'good';
  if (ece <= config.neutral.maxEce && clv >= config.neutral.minClv) return 'neutral';
  return 'avoid';
}

export const MARKET_QUALITY_LABELS: Record<MarketQualityLabel, string> = {
  excellent: 'Excellent',
  good: 'Good',
  neutral: 'Neutral',
  avoid: 'Avoid',
};