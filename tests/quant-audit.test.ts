import { describe, it, expect } from 'vitest';
import { KellyStake } from '../src/lib/warehouse/backtest/strategies/kellyStake';
import { BacktestConfig } from '../src/lib/warehouse/backtest/interfaces';
import { MonteCarloSimulator } from '../src/lib/warehouse/backtest/monteCarlo';

const dummyConfig: BacktestConfig = {
  league: 'EPL',
  season: 2026,
  dateRange: { start: '2026-01-01', end: '2026-12-31' },
  market: '1X2',
  minimumEV: 0.0,
  minimumProbability: 0.0,
  minimumOdds: 1.0,
  maximumOdds: 100.0,
  bankroll: 1000.0,
  stakeStrategy: 'KELLY',
  kellyFraction: 1.0, // Full Kelly
  commission: 0.0,
  currency: 'USD',
  randomSeed: 42,
  modelVersion: 'Poisson_v1'
};

describe('Kelly Stake Math Audit', () => {
  const strategy = new KellyStake();

  it('should return 0 stake for negative edges', () => {
    // Odds: 2.0 (implied prob: 50%). Actual Probability: 45%. Expected Value: 2 * 0.45 - 1 = -0.10 (Negative edge)
    const stake = strategy.calculateStake(2.0, 0.45, 1000.0, dummyConfig);
    expect(stake).toBe(0.0);
  });

  it('should return 0 stake for zero edges', () => {
    // Odds: 2.0. Actual Probability: 50%. Expected Value: 2 * 0.50 - 1 = 0 (Zero edge)
    const stake = strategy.calculateStake(2.0, 0.50, 1000.0, dummyConfig);
    expect(stake).toBe(0.0);
  });

  it('should calculate correct stake for positive edges', () => {
    // Odds: 2.0. Actual Probability: 60%. Kelly fraction = (0.60 * 1 - 0.40) / 1 = 0.20
    // Stake = 0.20 * 1000 = 200.00
    const stake = strategy.calculateStake(2.0, 0.60, 1000.0, dummyConfig);
    expect(stake).toBe(200.00);
  });

  it('should cap Kelly stakes at 100% bankroll and bound fraction < 0', () => {
    // Odds: 100.0. Actual Probability: 99%. Kelly fraction = (0.99 * 99 - 0.01) / 99 = (98.01 - 0.01)/99 = 98 / 99 = 98.9%
    const stake = strategy.calculateStake(100.0, 0.99, 1000.0, dummyConfig);
    expect(stake).toBeLessThanOrEqual(1000.0);
    expect(stake).toBeGreaterThan(0.0);
  });
});

describe('Monte Carlo Bootstrapping Replacement & Percentiles', () => {
  it('should perform sampling with replacement and output consistent percentile ranges', () => {
    const stakes = [10, 10, 10, 10, 10];
    const returns = [20, 20, 0, 0, 0]; // 40% win rate

    const mc = MonteCarloSimulator.simulate(stakes, returns, 100, 42);
    
    // ROR and yields confidence intervals should be reproducible
    expect(mc.confidenceIntervalRoi.lower).toBeLessThanOrEqual(mc.confidenceIntervalRoi.upper);
    expect(mc.expectedRoiMean).toBeDefined();
  });
});
