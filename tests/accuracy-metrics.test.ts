import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalibrationError } from '../src/lib/metrics/calibration-error';
import { ReliabilityChecker } from '../src/lib/metrics/reliability';
import { AccuracyCalculator } from '../src/lib/metrics/accuracy-calculator';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase Client
vi.mock('../src/lib/supabase.server', () => {
  const mockSelect = vi.fn();
  return {
    supabase: {
      from: vi.fn(() => ({
        select: mockSelect
      })),
      rpc: vi.fn()
    }
  };
});

describe('Accuracy and Analytics Metrics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('CalibrationError (ECE)', () => {
    it('should calculate ECE and distribute items into buckets correctly', () => {
      // 5 predictions: 2 favor-wins, 3 favor-losses
      const predictions = [
        { probability: 0.85, actual: 1 },
        { probability: 0.75, actual: 1 },
        { probability: 0.65, actual: 0 },
        { probability: 0.45, actual: 0 },
        { probability: 0.15, actual: 0 }
      ];

      const res = CalibrationError.calculate(predictions);
      expect(res.error).toBeGreaterThanOrEqual(0);
      expect(res.buckets.length).toBe(10);
      
      // Bucket 80-90% should have 1 item with expected 0.85 and actual 1.0
      const b80 = res.buckets.find(b => b.range === '80-90%');
      expect(b80?.sampleSize).toBe(1);
      expect(b80?.expectedWinRate).toBe(0.85);
      expect(b80?.actualWinRate).toBe(1.0);
    });

    it('should return 0 error and empty buckets when input is empty', () => {
      const res = CalibrationError.calculate([]);
      expect(res.error).toBe(0);
      expect(res.buckets.length).toBe(0);
    });
  });

  describe('ReliabilityChecker', () => {
    it('should approve reliability when all conditions are satisfied', () => {
      const result = ReliabilityChecker.check({
        sampleSize: 150,
        avgBrierScore: 0.18,
        coverage: 0.85
      });
      expect(result.reliable).toBe(true);
      expect(result.reasons.length).toBe(0);
    });

    it('should reject reliability with explicit reasons if checks fail', () => {
      const result = ReliabilityChecker.check({
        sampleSize: 50, // too small
        avgBrierScore: 0.28, // too high
        coverage: 0.70 // too low
      });
      expect(result.reliable).toBe(false);
      expect(result.reasons.length).toBe(3);
      expect(result.reasons[0]).toContain('sample size');
      expect(result.reasons[1]).toContain('Brier score');
      expect(result.reasons[2]).toContain('coverage');
    });
  });

  describe('AccuracyCalculator Orchestrator', () => {
    it('should aggregate metrics and partition them by market, league, and confidence', async () => {
      const mockDbResults = [
        {
          id: 'res-1',
          actual_home_score: 2,
          actual_away_score: 1,
          hit_1x2: true,
          hit_ah: false,
          hit_ou: false,
          profit_1x2: 0.95,
          profit_ah: 0,
          profit_ou: 0,
          predictions: [{
            id: 'pred-1',
            match_id: 'match-1',
            market_type: 'ML',
            prediction: { pHome: 0.65, pDraw: 0.20, pAway: 0.15 },
            odds_snapshot: { homeOdds: 2.0, drawOdds: 3.0, awayOdds: 4.0 },
            closing_odds: { homeOdds: 1.95, drawOdds: 3.10, awayOdds: 4.10 },
            model_version: 'prematch-v1',
            brier_score: 0.15,
            clv: -0.025,
            created_at: new Date().toISOString()
          }],
          matches: [{
            id: 'match-1',
            league: 'Premier League',
            kickoff: new Date().toISOString()
          }]
        }
      ];

      // Mock database queries
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'prediction_results') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockDbResults, error: null })
          } as any;
        }
        if (table === 'matches') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gt: vi.fn().mockResolvedValue({ count: 5, error: null })
              }))
            }))
          } as any;
        }
        return {} as any;
      });

      const metrics = await AccuracyCalculator.getMetrics({ days: 30, model_version: 'prematch-v1' });

      expect(metrics.overall.totalPredictions).toBe(1);
      expect(metrics.overall.roi).toBeGreaterThan(0);
      expect(metrics.byMarket.ML.totalPredictions).toBe(1);
      expect(metrics.byLeague['Premier League'].totalPredictions).toBe(1);
      expect(metrics.byConfidence.MEDIUM.totalPredictions).toBe(1); // 0.65 is medium confidence
      expect(metrics.reliability.reliable).toBe(false); // sample size < 100
    });
  });
});
