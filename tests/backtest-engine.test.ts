import { describe, it, expect } from 'vitest';
import { BacktestEngine, FeatureLeakageError } from '../src/lib/warehouse/backtest/backtestEngine';
import { BacktestConfig } from '../src/lib/warehouse/backtest/interfaces';
import { MonteCarloSimulator } from '../src/lib/warehouse/backtest/monteCarlo';

const baseConfig: BacktestConfig = {
  league: 'EPL',
  season: 2026,
  dateRange: { start: '2026-01-01', end: '2026-12-31' },
  market: '1X2',
  minimumEV: 0.02,
  minimumProbability: 0.50,
  minimumOdds: 1.5,
  maximumOdds: 5.0,
  bankroll: 1000.0,
  stakeStrategy: 'KELLY',
  kellyFraction: 0.5,
  commission: 0.0,
  currency: 'USD',
  randomSeed: 42,
  modelVersion: 'Poisson_v1'
};

const mockFixtures = [
  { id: 101, kickoffTime: '2026-07-01T12:00:00Z', odds: 2.10, predictedProbability: 0.55, home_goals: 2, away_goals: 1 },
  { id: 102, kickoffTime: '2026-07-02T12:00:00Z', odds: 1.85, predictedProbability: 0.60, home_goals: 1, away_goals: 2 }
];

const cleanFeatures = [
  { fixtureId: 101, timestamp: '2026-07-01T10:00:00Z' },
  { fixtureId: 102, timestamp: '2026-07-02T10:00:00Z' }
];

describe('BacktestEngine Deterministic Event Loop', () => {
  it('should run backtest cleanly and resolve Kelly stakes', () => {
    const engine = new BacktestEngine(baseConfig);
    const { metrics, totalEvents } = engine.run(mockFixtures, cleanFeatures);

    expect(totalEvents).toBe(4); // 2 fixtures * 2 events
    expect(metrics.totalBets).toBe(2);
    expect(metrics.roi).toBeDefined();
    expect(metrics.winRate).toBe(50.0);
  });

  it('should guarantee deterministic replay across duplicate runs', () => {
    const engine1 = new BacktestEngine(baseConfig);
    const run1 = engine1.run(mockFixtures, cleanFeatures);

    const engine2 = new BacktestEngine(baseConfig);
    const run2 = engine2.run(mockFixtures, cleanFeatures);

    expect(run1.metrics.roi).toBe(run2.metrics.roi);
    expect(run1.metrics.maxDrawdown).toBe(run2.metrics.maxDrawdown);
  });

  it('should throw FeatureLeakageError on future-dated features', () => {
    const leakedFeatures = [
      { fixtureId: 101, timestamp: '2026-07-01T15:00:00Z' } // 3 hours AFTER kickoff
    ];

    const engine = new BacktestEngine(baseConfig);
    expect(() => engine.run(mockFixtures, leakedFeatures)).toThrow(FeatureLeakageError);
  });
});

describe('MonteCarloSimulator Bootstrap Bounds', () => {
  it('should compute deterministic confidence intervals', () => {
    const stakes = [10, 10, 10, 10, 10];
    const returns = [20, 0, 20, 0, 20]; // 3 wins, 2 losses

    const mc = MonteCarloSimulator.simulate(stakes, returns, 100, 42);
    expect(mc.expectedRoiMean).toBeDefined();
    expect(mc.confidenceIntervalRoi.lower).toBeLessThan(mc.confidenceIntervalRoi.upper);
  });
});
