// Monte Carlo Engine Unit Tests
// Location: tests/monte-carlo.test.ts

import { describe, it, expect } from 'vitest';
import { MonteCarloEngine } from '../src/lib/engine/monte-carlo';

describe('MonteCarloEngine', () => {
  it('should forecast returns and risk for a simple portfolio', () => {
    // 3 active value bets
    const bets = [
      { probability: 0.60, odds: 2.0, weight: 0.05 },
      { probability: 0.55, odds: 2.10, weight: 0.04 },
      { probability: 0.70, odds: 1.80, weight: 0.06 }
    ];

    const report = MonteCarloEngine.simulate({
      bets,
      initialBankroll: 10000,
      numPaths: 1000
    });

    expect(report.finalValueMean).toBeGreaterThan(10000);
    expect(report.expectedReturnPercent).toBeGreaterThan(0.0);
    expect(report.maxDrawdownEstimate).toBeLessThanOrEqual(1.0);
    expect(report.ruinProbability).toBeLessThan(0.05);
    expect(report.var95Percent).toBeGreaterThanOrEqual(0.0);
  });
});
