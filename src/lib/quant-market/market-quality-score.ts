// EPIC 38 — Market Quality Score Engine (0 - 100)
// Evaluates market efficiency based on overround, volatility, consensus deviation, and historical closing efficiency.

export interface MarketQualityInput {
  overround: number; // e.g. 0.025 (2.5%)
  volatility: number; // e.g. 0.02
  booksAvailable: number; // e.g. 8
  consensusDeviation: number; // e.g. 0.01
  leagueEfficiency: number; // e.g. 0.92
}

export interface MarketQualityReport {
  score: number; // 0 - 100
  tier: 'INSTITUTIONAL' | 'LIQUID' | 'MODERATE' | 'ILLIQUID';
  overroundSubscore: number;
  volatilitySubscore: number;
  liquiditySubscore: number;
  consensusSubscore: number;
  explanation: string;
}

export class MarketQualityEngine {
  /** Compute 0-100 Market Quality Score */
  static computeMarketQuality(input: MarketQualityInput): MarketQualityReport {
    // 1. Overround Subscore (0-30 pts)
    const overroundSubscore = Math.max(0, 30 - input.overround * 500);

    // 2. Volatility Subscore (0-25 pts)
    const volatilitySubscore = Math.max(0, 25 - input.volatility * 500);

    // 3. Liquidity Subscore (0-25 pts)
    const liquiditySubscore = Math.min(25, input.booksAvailable * 3.5);

    // 4. Consensus Subscore (0-20 pts)
    const consensusSubscore = Math.max(0, 20 - input.consensusDeviation * 400);

    const score = Number(Math.min(100, Math.max(0, overroundSubscore + volatilitySubscore + liquiditySubscore + consensusSubscore)).toFixed(1));

    let tier: 'INSTITUTIONAL' | 'LIQUID' | 'MODERATE' | 'ILLIQUID' = 'MODERATE';
    if (score >= 85) tier = 'INSTITUTIONAL';
    else if (score >= 70) tier = 'LIQUID';
    else if (score < 50) tier = 'ILLIQUID';

    return {
      score,
      tier,
      overroundSubscore: Number(overroundSubscore.toFixed(1)),
      volatilitySubscore: Number(volatilitySubscore.toFixed(1)),
      liquiditySubscore: Number(liquiditySubscore.toFixed(1)),
      consensusSubscore: Number(consensusSubscore.toFixed(1)),
      explanation: `Market Quality Score ${score}/100 (${tier}). Bookmaker margin: ${(input.overround * 100).toFixed(2)}%, Books: ${input.booksAvailable}.`,
    };
  }
}
