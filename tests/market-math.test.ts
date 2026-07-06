// Market Math Unit Tests
// Location: tests/market-math.test.ts

import { describe, it, expect } from 'vitest';
import { MarketMath } from '../src/lib/engine/market-math';

describe('MarketMath Margins Removal', () => {
  it('should accurately calculate implied probability and overround', () => {
    // Odds: Home: 2.00, Draw: 3.40, Away: 3.80
    const odds = { home: 2.0, draw: 3.4, away: 3.8 };
    const result = MarketMath.calculateOverround(odds);

    expect(result.implied.home).toBeCloseTo(0.5, 4);
    expect(result.implied.draw).toBeCloseTo(0.294118, 4);
    expect(result.implied.away).toBeCloseTo(0.263158, 4);
    expect(result.overround).toBeCloseTo(0.057276, 4);
  });

  it('should remove margin proportionally', () => {
    const odds = { home: 1.85, away: 2.05 };
    const result = MarketMath.removeMarginProportional(odds);

    const sumFair = Object.values(result.fairProbabilities).reduce((a, b) => a + b, 0);
    expect(sumFair).toBeCloseTo(1.0, 5);
    expect(result.overround).toBeGreaterThan(0.0);
  });

  it('should remove margin using Shin method', () => {
    const odds = { home: 1.80, draw: 3.20, away: 4.00 };
    const result = MarketMath.removeMarginShin(odds);

    const sumFair = Object.values(result.fairProbabilities).reduce((a, b) => a + b, 0);
    expect(sumFair).toBeCloseTo(1.0, 5);
    expect(result.shinZ).toBeDefined();
    expect(result.shinZ).toBeGreaterThanOrEqual(0.0);
  });
});
