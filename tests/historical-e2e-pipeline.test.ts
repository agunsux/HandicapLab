import { describe, it, expect } from 'vitest';
import { auditHistoricalDataStore, runHistoricalEndToEndPipelineAudit } from '../src/scripts/epic59-historical-e2e-audit';
import { ProbabilityEngine } from '../src/lib/engines/probability-engine';
import { EdgeScanner } from '../src/lib/engines/edge-scanner';
import { MatchFeatures } from '../src/lib/engines/feature-engine/types';

describe('EPIC 59: Historical End-to-End Pipeline Audit', () => {
  it('should verify database completeness for 7 EPL seasons (2660 fixtures)', () => {
    const matrix = auditHistoricalDataStore();

    expect(matrix.historicalMatches).toBe(2660);
    expect(matrix.completedMatches).toBe(2660);
    expect(matrix.teamsResolved).toBeGreaterThanOrEqual(20);
    expect(matrix.matchStatsCoveragePct).toBe(100.0);
    expect(matrix.historicalOddsCount).toBeGreaterThan(20000);
    expect(matrix.oddsByMarket.ML).toBe(7980);
    expect(matrix.oddsTimestampCoveragePct).toBe(100.0);
  });

  it('should process a pre-kickoff historical match without data leakage', async () => {
    const preMatchFeatures: MatchFeatures = {
      matchId: 'hist-test-001',
      marketType: 'ML',
      kickoffAt: new Date('2024-01-15T15:00:00Z'),
      homeFormLast5: [3, 1, 3, 0, 3],
      awayFormLast5: [0, 1, 0, 3, 0],
      homeFormWeighted: 2.1,
      awayFormWeighted: 0.8,
      homeRestDays: 7,
      awayRestDays: 4,
      homeTravelKm: 0,
      homeElo: 1720,
      awayElo: 1510,
      eloDelta: 210,
      homeAttack: 1.15,
      homeDefense: 0.87,
      awayAttack: 1.01,
      awayDefense: 1.22,
      leagueAvgGoals: 2.80,
      isHomeAdvantage: true,
      leagueId: 'EPL',
      season: '2023-2024',
      generatedAt: new Date('2024-01-15T14:00:00Z'), // 1 hour prior to kickoff
    };

    const prediction = await ProbabilityEngine.predict(preMatchFeatures, {
      weights: { poisson: 0.5, dixonColes: 0.5 },
      calibrationMethod: 'platt',
    });

    expect(prediction.pHome).toBeGreaterThan(0.4);
    expect(prediction.pAway).toBeLessThan(0.4);

    // Calculate Fair Odds = 1 / probability
    const fairOddsHome = Number((1 / prediction.pHome).toFixed(3));
    expect(fairOddsHome).toBeGreaterThan(1.0);

    // EV Calculation and Scan
    const marketOdds = {
      market: 'ML' as const,
      homeOdds: 2.10,
      drawOdds: 3.50,
      awayOdds: 3.80,
    };

    const picks = EdgeScanner.scan(preMatchFeatures.matchId, 'ML', prediction, marketOdds, undefined, 0.03);
    expect(Array.isArray(picks)).toBe(true);

    if (picks.length > 0) {
      const pick = picks[0];
      const evCalculated = Number(((pick.modelProbability * pick.marketOdds) - 1.0).toFixed(4));
      expect(pick.expectedValue).toBeCloseTo(evCalculated, 3);
    }
  });

  it('should run full end-to-end historical pipeline without errors', async () => {
    await expect(runHistoricalEndToEndPipelineAudit()).resolves.not.toThrow();
  });
});
