import { describe, it, expect } from 'vitest';
import { erfc, calculateQuantitativeMetrics, LedgerItemForCalc } from '../src/lib/validation/metricsCalculator';

describe('MetricsCalculator & Numerical Helpers', () => {
  describe('Abramowitz & Stegun erfc Approximation', () => {
    it('should compute erfc(0) = 1.0 exactly', () => {
      expect(erfc(0)).toBeCloseTo(1.0, 6);
    });

    it('should compute erfc(1) approx 0.157299', () => {
      // Known reference value: erfc(1) = 0.1572992070502851
      expect(erfc(1)).toBeCloseTo(0.157299, 5);
    });

    it('should compute erfc(2) approx 0.0046777', () => {
      // Known reference value: erfc(2) = 0.004677734981047266
      expect(erfc(2)).toBeCloseTo(0.004677, 5);
    });

    it('should satisfy symmetry relation erfc(-x) = 2 - erfc(x)', () => {
      const x = 1.5;
      expect(erfc(-x)).toBeCloseTo(2.0 - erfc(x), 6);
    });
  });

  describe('Dynamic Metrics Engine', () => {
    it('should calculate Brier Score, Log Loss, ROI, and p-value dynamically', () => {
      const mockLedger: LedgerItemForCalc[] = [
        { id: '1', published_at: '2026-07-20T10:00:00Z', market: 'AH', selection: 'Home', odds_at_prediction: 2.0, confidence: 60, result_status: 'won', settled_at: '2026-07-20T14:00:00Z', roi: 100 },
        { id: '2', published_at: '2026-07-21T10:00:00Z', market: 'OU', selection: 'Over', odds_at_prediction: 1.9, confidence: 55, result_status: 'won', settled_at: '2026-07-21T14:00:00Z', roi: 90 },
        { id: '3', published_at: '2026-07-22T10:00:00Z', market: '1X2', selection: 'Away', odds_at_prediction: 2.1, confidence: 45, result_status: 'lost', settled_at: '2026-07-22T14:00:00Z', roi: -100 },
        { id: '4', published_at: '2026-07-22T12:00:00Z', market: 'AH', selection: 'Home', odds_at_prediction: 1.85, confidence: 65, result_status: 'won', settled_at: '2026-07-22T16:00:00Z', roi: 85 },
        { id: '5', published_at: '2026-07-22T13:00:00Z', market: 'OU', selection: 'Under', odds_at_prediction: 1.95, confidence: 52, result_status: 'won', settled_at: '2026-07-22T17:00:00Z', roi: 95 },
      ];

      const res = calculateQuantitativeMetrics(mockLedger);
      expect(res.settledCount).toBe(5);
      expect(res.winCount).toBe(4);
      expect(res.winRatePct).toBe(80);
      expect(res.roiYieldPct).toBeGreaterThan(0);
      expect(res.pValueRoi).toBeGreaterThan(0);
      expect(res.pValueRoi).toBeLessThanOrEqual(1.0);
      expect(res.threeTimestampVerifiedPct).toBe(100);
    });
  });
});
