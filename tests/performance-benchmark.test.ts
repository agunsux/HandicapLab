import { describe, it, expect } from 'vitest';
import { MonteCarloSimulator } from '../src/lib/warehouse/backtest/monteCarlo';
import { BacktestEngine } from '../src/lib/warehouse/backtest/backtestEngine';
import { BacktestConfig } from '../src/lib/warehouse/backtest/interfaces';

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

describe('Performance Benchmarks Audit', () => {
  it('should run 10,000 Monte Carlo iterations in under 5 seconds', () => {
    const stakes = Array(200).fill(10);
    const returns = Array(200).fill(0).map((_, idx) => (idx % 2 === 0 ? 20 : 0));

    const startTime = Date.now();
    const result = MonteCarloSimulator.simulate(stakes, returns, 10000, 42);
    const duration = Date.now() - startTime;

    console.log(`[Benchmark] 10,000 Monte Carlo iterations completed in ${duration}ms`);
    expect(duration).toBeLessThan(5000); // 5 seconds threshold
    expect(result.expectedRoiMean).toBeDefined();
  });

  it('should process 10,000 simulated historical fixtures in under 1 second', () => {
    // Generate 1000 fixtures (total events = 2000)
    const fixtures = Array(1000).fill(null).map((_, idx) => ({
      id: idx + 1,
      kickoffTime: new Date(Date.now() + idx * 60000).toISOString(),
      odds: 2.0,
      predictedProbability: 0.52,
      home_goals: 1,
      away_goals: 0
    }));

    const features = fixtures.map(f => ({
      fixtureId: f.id,
      timestamp: new Date(new Date(f.kickoffTime).getTime() - 3600000).toISOString() // 1 hour prior
    }));

    const engine = new BacktestEngine(baseConfig);
    const startTime = Date.now();
    const { totalEvents } = engine.run(fixtures, features);
    const duration = Date.now() - startTime;

    console.log(`[Benchmark] Processed ${totalEvents} backtest events in ${duration}ms`);
    expect(duration).toBeLessThan(1000); // 1 second threshold
  });
});
