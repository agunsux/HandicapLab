import { describe, it, expect } from 'vitest';
import { BookmakerBenchmark } from '../../src/application/benchmark/bookmaker-benchmark';
import { MonteCarloSimulator } from '../../src/domain/bankroll/monte-carlo';
import { CapitalAllocationEngine } from '../../src/domain/bankroll/capital-allocation';
import type { ReplayOutcome } from '../../src/lib/epic31b/types';

describe('SUPER EPIC 31B.5C — Betting Intelligence Platform (Finance)', () => {
  const mockOutcomes: ReplayOutcome[] = [
    {
      fixtureId: 'EPL-1',
      marketType: 'ML',
      selection: 'home',
      predictedProbability: 0.60,
      actualResult: 1,
      profitLoss: 0.20,
      brierScore: 0.16,
      logLoss: 0.51,
      clv: 0.05,
      kellyStake: 0.10,
      expectedValue: 0.05,
      settledOutcome: 'WIN',
      settlementProfitUnits: 0.20,
      leagueId: '39',
    },
    {
      fixtureId: 'EPL-2',
      marketType: 'ML',
      selection: 'away',
      predictedProbability: 0.20,
      actualResult: 0,
      profitLoss: -0.05,
      brierScore: 0.04,
      logLoss: 0.22,
      clv: -0.02,
      kellyStake: 0.05,
      expectedValue: -0.02,
      settledOutcome: 'LOSS',
      settlementProfitUnits: -0.05,
      leagueId: '39',
    },
  ];

  it('should benchmark model predictions vs de-vig odds', () => {
    const oddsList = [
      { homeOdds: 1.5, drawOdds: 4.0, awayOdds: 6.0, selection: 'home' as const },
      { homeOdds: 1.8, drawOdds: 3.5, awayOdds: 4.5, selection: 'away' as const },
    ];

    const result = BookmakerBenchmark.benchmark(mockOutcomes, oddsList);
    expect(result.totalMatches).toBe(2);
    expect(result.averageCLV).toBe(0.015);
  });

  it('should simulate Monte Carlo bankroll projections', () => {
    const simulation = MonteCarloSimulator.simulate(mockOutcomes, { simulationsCount: 100 });
    expect(simulation.length).toBe(5); // 5 staking methods
    expect(simulation[0].medianBankroll).toBeDefined();
  });

  it('should apply capital allocation drawdown multipliers and caps', () => {
    // 50% drawdown (exceeds drawdown limit of 20%) -> multiplier becomes 0
    const allocated = CapitalAllocationEngine.allocate(mockOutcomes, { maxDrawdownLimit: 0.20 }, 0.50);
    expect(allocated[0].kellyStake).toBe(0);

    // No drawdown -> should respect league exposure cap (capped at 0.05)
    const normalAllocation = CapitalAllocationEngine.allocate(
      mockOutcomes,
      { maxDrawdownLimit: 0.20, maxLeagueExposure: { '39': 0.05 } },
      0.0
    );
    expect(normalAllocation[0].kellyStake).toBeLessThanOrEqual(0.05);
  });
});
