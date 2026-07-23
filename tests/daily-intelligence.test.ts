import { describe, it, expect } from 'vitest';
import {
  computeStarRating,
  computeKellyStake,
  aggregateYesterdayResults,
  extractResearchInsights
} from '../src/lib/engines/dailyIntelligence';

describe('Daily Intelligence Engine Unit Tests', () => {
  it('should compute 5-Star recommendation ratings correctly based on EV & Edge', () => {
    expect(computeStarRating(0.15, 9.0).stars).toBe('★★★★★');
    expect(computeStarRating(0.15, 9.0).label).toBe('Strong Bet');

    expect(computeStarRating(0.07, 5.0).stars).toBe('★★★★☆');
    expect(computeStarRating(0.07, 5.0).label).toBe('Value Bet');

    expect(computeStarRating(0.03, 2.5).stars).toBe('★★★☆☆');
    expect(computeStarRating(0.03, 2.5).label).toBe('Lean');

    expect(computeStarRating(0.01, 0.5).stars).toBe('★★☆☆☆');
    expect(computeStarRating(0.01, 0.5).label).toBe('Monitor');

    expect(computeStarRating(-0.05, 0).stars).toBe('★☆☆☆☆');
    expect(computeStarRating(-0.05, 0).label).toBe('Pass');
  });

  it('should compute Quarter-Kelly criterion stake correctly and enforce 5% cap', () => {
    // b = 1.0 (odds 2.0), p = 0.6, q = 0.4 -> full Kelly = (1*0.6 - 0.4)/1 = 0.20 -> 0.25 * 0.20 = 0.05 -> 5.0%
    const stake = computeKellyStake(0.60, 2.0, 0.25, 0.05);
    expect(stake).toBe(5.0);

    // Negative EV should return 0%
    const negStake = computeKellyStake(0.40, 2.0, 0.25, 0.05);
    expect(negStake).toBe(0);
  });

  it('should aggregate yesterday settlement metrics correctly', () => {
    const finishedMatches = [
      { result: 'WIN', odds: 1.85, stake: 1.0, clv: 0.10, ev: 0.08, brier: 0.15 },
      { result: 'WIN', odds: 2.10, stake: 1.0, clv: 0.12, ev: 0.09, brier: 0.14 },
      { result: 'LOSS', odds: 1.95, stake: 1.0, clv: 0.02, ev: 0.03, brier: 0.22 },
      { result: 'WIN', odds: 1.75, stake: 1.0, clv: 0.05, ev: 0.06, brier: 0.16 }
    ];

    const summary = aggregateYesterdayResults(finishedMatches);
    expect(summary.totalMatches).toBe(4);
    expect(summary.correctCount).toBe(3);
    expect(summary.accuracyPct).toBe(75);
    expect(summary.moneylineRoiPct).toBeGreaterThan(0);
    expect(summary.averageClv).toBe(0.07);
    expect(summary.calibrationGrade).toBe('Excellent');
  });

  it('should extract research insights from predictions feed', () => {
    const todayPredictions = [
      { match: 'Arsenal vs Villa', ev: 0.15, edge: 8.5, probability: 0.65, implied_probability: 0.52, market: 'ML', selection: 'Home Win' },
      { match: 'Chelsea vs Fulham', ev: 0.04, edge: 2.1, probability: 0.51, implied_probability: 0.49, market: 'AH', selection: 'Away +0.5' }
    ];

    const insights = extractResearchInsights(todayPredictions);
    expect(insights.highestEvMatch?.match).toBe('Arsenal vs Villa');
    expect(insights.highestEvMatch?.evPct).toBe(15);
    expect(insights.largestDisagreementMatch?.match).toBe('Arsenal vs Villa');
    expect(insights.mostUncertainMatch?.match).toBe('Chelsea vs Fulham');
  });
});
