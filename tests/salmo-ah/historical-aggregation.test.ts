import { describe, it, expect } from 'vitest';
import { AhHistoryService } from '../../src/lib/services/ahHistoryService';
import type { AhBetObservation } from '../../src/lib/research/ah-yield/ahTypes';

function makeMockObservation(overrides: Partial<AhBetObservation> = {}): AhBetObservation {
  return {
    observationId: 'obs-test-1',
    oddsId: 'odds-1',
    canonicalMatchId: 'm-1',
    leagueId: 'ENG-PL',
    season: '2024-2025',
    matchDate: '2024-11-01',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    homeScore: 2,
    awayScore: 1,
    side: 'home',
    marketLineHome: -0.5,
    selectionLine: -0.5,
    odds: 1.95,
    oppositeOdds: 1.95,
    snapshot: 'opening',
    provenance: 'pinnacle',
    favoriteStatus: 'favorite',
    sourceFile: 'test.csv',
    sourceRow: 1,
    dataSource: 'football-data.co.uk',
    settlement: 'FULL_WIN',
    settlementFraction: 1,
    stake: 1,
    pnl: 0.95,
    returnAmount: 1.95,
    ...overrides,
  };
}

describe('AhHistoryService — Aggregation & Filter Tests', () => {
  it('correctly computes aggregate metrics across a set of observations', () => {
    const obs: AhBetObservation[] = [
      makeMockObservation({ settlement: 'FULL_WIN', pnl: 0.95, odds: 1.95 }),
      makeMockObservation({ settlement: 'HALF_WIN', pnl: 0.475, odds: 1.95 }),
      makeMockObservation({ settlement: 'PUSH', pnl: 0.0, odds: 1.95 }),
      makeMockObservation({ settlement: 'HALF_LOSS', pnl: -0.5, odds: 1.95 }),
      makeMockObservation({ settlement: 'FULL_LOSS', pnl: -1.0, odds: 1.95 }),
    ];

    const metrics = AhHistoryService.computeAggregateMetrics(obs);

    expect(metrics.sampleSize).toBe(5);
    expect(metrics.fullWins).toBe(1);
    expect(metrics.halfWins).toBe(1);
    expect(metrics.pushes).toBe(1);
    expect(metrics.halfLosses).toBe(1);
    expect(metrics.fullLosses).toBe(1);

    // Total PnL = 0.95 + 0.475 + 0.0 - 0.5 - 1.0 = -0.075
    expect(metrics.totalPnl).toBe(-0.08);
    // Yield ROI = (-0.075 / 5) * 100 = -1.5%
    expect(metrics.yieldRoiPct).toBe(-1.5);
    // Hit rate = (1 + 0.5) / 4 = 1.5 / 4 = 37.5%
    expect(metrics.hitRatePct).toBe(37.5);
    // N < 30 gives INSUFFICIENT_SAMPLE
    expect(metrics.sampleStatus).toBe('INSUFFICIENT_SAMPLE');
    expect(metrics.historicalColor).toBe('GREY');
  });

  it('correctly assigns GREEN and YELLOW historical colors based on sample and positive yield', () => {
    // 40 bets with positive yield -> LOW_SAMPLE -> YELLOW
    const fortyWinningBets: AhBetObservation[] = Array(40).fill(null).map((_, i) =>
      makeMockObservation({ observationId: `w-${i}`, settlement: 'FULL_WIN', pnl: 0.90, odds: 1.90 })
    );
    const metrics40 = AhHistoryService.computeAggregateMetrics(fortyWinningBets);
    expect(metrics40.sampleStatus).toBe('LOW_SAMPLE');
    expect(metrics40.historicalColor).toBe('YELLOW');

    // 200 bets with positive yield -> MODERATE_SAMPLE -> GREEN
    const twoHundredWinningBets: AhBetObservation[] = Array(200).fill(null).map((_, i) =>
      makeMockObservation({ observationId: `w2-${i}`, settlement: 'FULL_WIN', pnl: 0.90, odds: 1.90 })
    );
    const metrics200 = AhHistoryService.computeAggregateMetrics(twoHundredWinningBets);
    expect(metrics200.sampleStatus).toBe('MODERATE_SAMPLE');
    expect(metrics200.historicalColor).toBe('GREEN');
  });

  it('returns available filters from real canonical data without throwing', () => {
    const filters = AhHistoryService.getAvailableFilters();

    expect(Array.isArray(filters.leagues)).toBe(true);
    expect(filters.leagues.length).toBeGreaterThan(0);
    expect(Array.isArray(filters.seasons)).toBe(true);
    expect(Array.isArray(filters.lines)).toBe(true);
    expect(filters.sides).toContain('home');
    expect(filters.sides).toContain('away');
  });

  it('queries real historical dataset and applies filters correctly', () => {
    const res = AhHistoryService.queryObservations({
      league: 'ENG-PL',
      side: 'home',
      limit: 10,
      offset: 0,
    });

    expect(res.observations.length).toBeLessThanOrEqual(10);
    if (res.observations.length > 0) {
      for (const o of res.observations) {
        expect(o.leagueId).toBe('ENG-PL');
        expect(o.side).toBe('home');
      }
    }
    expect(res.summary.sampleSize).toBe(res.totalMatchesAvailable);
    expect(res.datasetUpdated).toBeDefined();
  });
});
