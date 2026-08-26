// Test Suite for EPIC 60 Stage C — Canonical CLV Formula Reconciliation
import { describe, it, expect } from 'vitest';
import { DeVigService } from '../src/lib/settlement-core/devig';
import { CLVCalculator } from '../src/lib/settlement/clv-calculator';
import { LiveShadowEngine } from '../src/lib/shadow/liveShadowEngine';

describe('EPIC 60 Stage C — Canonical CLV Formula Reconciliation', () => {
  it('should compute canonical CLV as (takenOdds / closingOdds) - 1.0 in DeVigService', () => {
    // 10% beat
    expect(DeVigService.clv(2.20, 2.00)).toBeCloseTo(0.100000, 6);
    // 5% negative steam
    expect(DeVigService.clv(1.90, 2.00)).toBeCloseTo(-0.050000, 6);
    // Invalid odds handling
    expect(DeVigService.clv(1.0, 2.00)).toBeNaN();
    expect(DeVigService.clv(2.0, 0)).toBeNaN();
  });

  it('should compute canonical CLV against fair closing price in DeVigService for market selections', () => {
    // 2-way market with vig: Pinnacle Over 1.95, Under 1.95 -> Fair 2.00 (prob 0.50)
    // If taken at 2.10, CLV vs fair closing = 2.10 * 0.50 - 1.0 = +5.0%
    const market = { over: 1.95, under: 1.95 };
    const clv = DeVigService.clv(2.10, market, 'over');
    expect(clv).toBeCloseTo(0.050000, 4);
  });

  it('should compute canonical CLV in CLVCalculator', () => {
    expect(CLVCalculator.calculate(2.20, 2.00)).toBeCloseTo(0.100000, 6);
    expect(CLVCalculator.calculate(1.90, 2.00)).toBeCloseTo(-0.050000, 6);

    const detailed = CLVCalculator.calculateDetailed('ML', 'home', 0, 2.20, 0, 2.00);
    expect(detailed.clv_score).toBeCloseTo(0.1000, 4);
    expect(detailed.clv_percentage).toBeCloseTo(10.00, 2);
    expect(detailed.clv_category).toBe('Elite');
  });

  it('should compute canonical CLV in LiveShadowEngine', () => {
    const clv = LiveShadowEngine.computeCLV(2.20, 2.00);
    expect(clv).toBe(0.1000);

    const clvUnavailable = LiveShadowEngine.computeCLV(2.20, 'UNAVAILABLE');
    expect(clvUnavailable).toBe('UNAVAILABLE');
  });
});
