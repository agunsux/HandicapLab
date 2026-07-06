// HandicapLab Market Intelligence - Market Quality Scorer
// Location: src/lib/market/marketQualityScorer.ts

import { OddsSnapshot } from './providerInterface';

export interface QualityResult {
  stabilityScore: number;
  liquidityScore: number;
  consensusScore: number;
  volatilityScore: number;
  bookmakerAgreement: number;
  overallScore: number; // 0-100
}

export class MarketQualityScorer {
  /**
   * Calculates overall Market Quality Score based on stability, agreement, and liquidity.
   */
  public static calculate(
    volatilityScore: number,
    bookmakerOdds: Record<string, OddsSnapshot>,
    liquidityProxy: 'High' | 'Medium' | 'Low'
  ): QualityResult {
    const stabilityScore = Math.max(0, 100 - volatilityScore);
    
    let liquidityScore = 50;
    if (liquidityProxy === 'High') liquidityScore = 90;
    else if (liquidityProxy === 'Medium') liquidityScore = 70;
    else if (liquidityProxy === 'Low') liquidityScore = 30;

    const providerList = Object.values(bookmakerOdds);
    if (providerList.length === 0) {
      return {
        stabilityScore,
        liquidityScore,
        consensusScore: 0,
        volatilityScore,
        bookmakerAgreement: 0,
        overallScore: 0
      };
    }

    const homes = providerList.map((p) => p.home);
    const avgHome = homes.reduce((sum, h) => sum + h, 0) / homes.length;
    
    // Consensus: how close are bookmakers to the average
    const variance = homes.reduce((sum, h) => sum + Math.pow(h - avgHome, 2), 0) / homes.length;
    const stdDev = Math.sqrt(variance);

    // Consensus Score: 100 - (stdDev * 500) bounded
    const consensusScore = Math.max(0, Math.min(100, Math.round(100 - (stdDev * 300))));

    // Bookmaker Agreement: percentage of providers within 1.5% margin of the average
    const agreeingCount = homes.filter((h) => Math.abs(h - avgHome) / avgHome <= 0.015).length;
    const bookmakerAgreement = Math.round((agreeingCount / homes.length) * 100);

    // Combined overall quality score (weighted average)
    const overallScore = Math.round(
      (stabilityScore * 0.25) +
      (liquidityScore * 0.30) +
      (consensusScore * 0.25) +
      (bookmakerAgreement * 0.20)
    );

    return {
      stabilityScore,
      liquidityScore,
      consensusScore,
      volatilityScore,
      bookmakerAgreement,
      overallScore: Math.max(0, Math.min(100, overallScore))
    };
  }
}
