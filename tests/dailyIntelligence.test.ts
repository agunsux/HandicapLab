import { describe, it, expect } from 'vitest';
import {
  computeStarRating,
  computeKellyStake,
  aggregateYesterdayResults,
  extractResearchInsights,
  getEvHeatmapColor,
  computePortfolioSummary,
  extractBestPick,
  computeBetTiming,
  extractSimilarMatchesCohort,
  evaluatePortfolioCorrelation,
  checkMinimumAcceptableOdds
} from '../src/lib/engines/dailyIntelligence';

describe('Daily Intelligence Engine Unit Tests', () => {
  describe('computeStarRating', () => {
    it('should assign 5 stars (Strong Bet) for high EV and Edge', () => {
      const result = computeStarRating(0.15, 9.0);
      expect(result.stars).toBe('★★★★★');
      expect(result.label).toBe('Strong Bet');
    });

    it('should assign 4 stars (Value Bet) for medium-high EV and Edge', () => {
      const result = computeStarRating(0.08, 5.0);
      expect(result.stars).toBe('★★★★☆');
      expect(result.label).toBe('Value Bet');
    });

    it('should assign 3 stars (Lean) for moderate EV', () => {
      const result = computeStarRating(0.03, 2.5);
      expect(result.stars).toBe('★★★☆☆');
      expect(result.label).toBe('Lean');
    });

    it('should assign 2 stars (Monitor) for slight positive EV', () => {
      const result = computeStarRating(0.01, 0.5);
      expect(result.stars).toBe('★★☆☆☆');
      expect(result.label).toBe('Monitor');
    });

    it('should assign 1 star (Pass) for zero or negative EV', () => {
      const result = computeStarRating(-0.02, -1.0);
      expect(result.stars).toBe('★☆☆☆☆');
      expect(result.label).toBe('Pass');
    });
  });

  describe('computeKellyStake', () => {
    it('should calculate quarter Kelly stake correctly', () => {
      // prob = 0.60, odds = 2.0 (b = 1.0)
      // full kelly = (1.0 * 0.6 - 0.4) / 1.0 = 0.20
      // 0.25 fraction = 0.05 (5.0%)
      const stake = computeKellyStake(0.60, 2.0, 0.25, 0.05);
      expect(stake).toBe(5.0);
    });

    it('should return 0 stake when EV is negative or odds <= 1', () => {
      expect(computeKellyStake(0.40, 2.0)).toBe(0);
      expect(computeKellyStake(0.60, 1.0)).toBe(0);
    });
  });

  describe('aggregateYesterdayResults', () => {
    it('should aggregate yesterday finished matches metrics accurately', () => {
      const mockMatches = [
        { is_correct: true, result: 'WIN', odds: 1.82, stake: 1.0, clv: 0.11, ev: 0.07, brier: 0.15 },
        { is_correct: false, result: 'LOSS', odds: 2.10, stake: 1.0, clv: 0.03, ev: 0.04, brier: 0.22 },
        { is_correct: true, result: 'WIN', odds: 1.95, stake: 1.0, clv: 0.08, ev: 0.06, brier: 0.16 }
      ];

      const summary = aggregateYesterdayResults(mockMatches);
      expect(summary.totalMatches).toBe(3);
      expect(summary.correctCount).toBe(2);
      expect(summary.accuracyPct).toBe(66.7);
      expect(summary.moneylineRoiPct).toBeGreaterThan(0);
      expect(summary.averageClv).toBe(0.07);
      expect(summary.calibrationGrade).toBe('Excellent');
    });

    it('should handle empty finished matches gracefully', () => {
      const summary = aggregateYesterdayResults([]);
      expect(summary.totalMatches).toBe(0);
      expect(summary.accuracyPct).toBe(0);
      expect(summary.calibrationGrade).toBe('Fair');
    });
  });

  describe('extractResearchInsights', () => {
    it('should extract highest EV and largest disagreement match', () => {
      const mockPredictions = [
        { match: 'Arsenal vs Aston Villa', ev: 0.17, market: 'ML', selection: 'Arsenal', probability: 0.61, implied_probability: 0.52, edge: 9.0, confidence_score: 85 },
        { match: 'Chelsea vs Everton', ev: 0.05, market: 'ML', selection: 'Chelsea', probability: 0.51, implied_probability: 0.49, edge: 2.0, confidence_score: 55 }
      ];

      const insights = extractResearchInsights(mockPredictions);
      expect(insights.highestEvMatch?.match).toBe('Arsenal vs Aston Villa');
      expect(insights.highestEvMatch?.evPct).toBe(17);
      expect(insights.largestDisagreementMatch?.match).toBe('Arsenal vs Aston Villa');
      expect(insights.mostUncertainMatch?.match).toBe('Chelsea vs Everton');
    });
  });

  describe('getEvHeatmapColor', () => {
    it('should return dark emerald for EV >= 12%', () => {
      expect(getEvHeatmapColor(0.15)).toContain('bg-emerald-500/25');
    });

    it('should return light emerald for EV >= 5%', () => {
      expect(getEvHeatmapColor(0.07)).toContain('bg-emerald-500/15');
    });

    it('should return amber for EV >= 2%', () => {
      expect(getEvHeatmapColor(0.03)).toContain('bg-amber-500/15');
    });

    it('should return rose for EV < 0%', () => {
      expect(getEvHeatmapColor(-0.04)).toContain('bg-rose-500/20');
    });
  });

  describe('computePortfolioSummary & extractBestPick', () => {
    it('should compute portfolio metrics and extract #1 best pick', () => {
      const mockPredictions = [
        { id: '1', match: 'Arsenal vs Aston Villa', ev: 0.17, edge: 9.0, kellyPct: 2.4, confidence_score: 96, market: 'ML', selection: 'Arsenal', odds: 1.92, fairOdds: 1.64 },
        { id: '2', match: 'Liverpool vs Everton', ev: 0.08, edge: 4.5, kellyPct: 1.5, confidence_score: 89, market: 'ML', selection: 'Liverpool', odds: 1.85, fairOdds: 1.68 }
      ];

      const summary = computePortfolioSummary(mockPredictions);
      expect(summary.picksCount).toBe(2);
      expect(summary.expectedRoiPct).toBe(12.5);
      expect(summary.kellyExposurePct).toBe(3.9);
      expect(summary.riskLevel).toBe('Low');

      const best = extractBestPick(mockPredictions);
      expect(best?.match).toBe('Arsenal vs Aston Villa');
      expect(best?.evPct).toBe(17);
      expect(best?.confidenceScore).toBe(96);
    });
  });

  describe('computeBetTiming', () => {
    it('should return BET NOW when current odds are dropping relative to expected closing', () => {
      const res = computeBetTiming(1.92, 1.83, 0.12);
      expect(res.action).toBe('BET NOW');
      expect(res.reason).toContain('Line is dropping rapidly');
    });

    it('should return WAIT when expected closing odds are drifting higher', () => {
      const res = computeBetTiming(1.80, 1.88, 0.04);
      expect(res.action).toBe('WAIT');
      expect(res.reason).toContain('Market line is drifting higher');
    });

    it('should return NO BET when EV is non-positive', () => {
      const res = computeBetTiming(1.80, 1.80, -0.02);
      expect(res.action).toBe('NO BET');
    });
  });

  describe('evaluatePortfolioCorrelation', () => {
    it('should flag HIGH correlation when 3+ bets are in the same league', () => {
      const selectedBets = [
        { league: 'Premier League', ev: 0.12, kellyPct: 2.0 },
        { league: 'Premier League', ev: 0.08, kellyPct: 1.5 },
        { league: 'Premier League', ev: 0.06, kellyPct: 1.2 }
      ];

      const res = evaluatePortfolioCorrelation(selectedBets);
      expect(res.correlation).toBe('HIGH');
      expect(res.reason).toContain('Concentrated variance coupling');
    });

    it('should flag LOW correlation for diversified multi-league bets', () => {
      const selectedBets = [
        { league: 'Premier League', ev: 0.12, kellyPct: 2.0 },
        { league: 'Serie A', ev: 0.08, kellyPct: 1.5 },
        { league: 'La Liga', ev: 0.06, kellyPct: 1.2 }
      ];

      const res = evaluatePortfolioCorrelation(selectedBets);
      expect(res.correlation).toBe('LOW');
    });
  });

  describe('checkMinimumAcceptableOdds', () => {
    it('should approve bet when current odds meet or exceed threshold', () => {
      const res = checkMinimumAcceptableOdds(1.85, 1.80);
      expect(res.isAcceptable).toBe(true);
      expect(res.statusLabel).toBe('BET APPROVED');
    });

    it('should return DO NOT BET when current odds drop below threshold', () => {
      const res = checkMinimumAcceptableOdds(1.75, 1.80);
      expect(res.isAcceptable).toBe(false);
      expect(res.statusLabel).toBe('DO NOT BET');
    });
  });
});
