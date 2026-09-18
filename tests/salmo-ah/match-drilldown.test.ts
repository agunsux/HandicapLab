import { describe, it, expect } from 'vitest';
import { AhHistoryService } from '../../src/lib/services/ahHistoryService';
import { settleAhBet } from '../../src/lib/research/ah-yield/ahSettlement';

describe('AhHistoryService — Match Drilldown & Calculation Trace Tests', () => {
  it('correctly decomposes quarter-line handicap -0.75 with score 2-1 into HALF_WIN', () => {
    // Score 2-1 (home win by 1)
    // AH -0.75 splits into:
    // -0.5 (component 1): margin 1 - 0.5 = +0.5 > 0 -> FULL_WIN
    // -1.0 (component 2): margin 1 - 1.0 = 0.0 -> PUSH
    // Combined: HALF_WIN, settlementFraction = +0.5
    // Odds 1.90 -> P&L = 0.5 * (1.90 - 1) = +0.45
    const settled = settleAhBet({
      side: 'home',
      line: -0.75,
      homeScore: 2,
      awayScore: 1,
      odds: 1.90,
      stake: 1,
    });

    expect(settled.isQuarterLine).toBe(true);
    expect(settled.outcome).toBe('HALF_WIN');
    expect(settled.settlementFraction).toBe(0.5);
    expect(settled.pnl).toBe(0.45);
    expect(settled.componentLines).toEqual([-1, -0.5]);
    expect(settled.componentOutcomes).toEqual(['PUSH', 'FULL_WIN']);
  });

  it('correctly decomposes quarter-line handicap +0.25 with score 0-0 into HALF_WIN', () => {
    // Score 0-0 (draw)
    // AH +0.25 splits into:
    // 0.0 (component 1): margin 0 + 0 = 0 -> PUSH
    // +0.5 (component 2): margin 0 + 0.5 = +0.5 -> FULL_WIN
    // Combined: HALF_WIN
    const settled = settleAhBet({
      side: 'home',
      line: 0.25,
      homeScore: 0,
      awayScore: 0,
      odds: 2.00,
      stake: 1,
    });

    expect(settled.isQuarterLine).toBe(true);
    expect(settled.outcome).toBe('HALF_WIN');
    expect(settled.settlementFraction).toBe(0.5);
    expect(settled.pnl).toBe(0.50);
  });

  it('correctly decomposes quarter-line handicap -0.25 with score 0-0 into HALF_LOSS', () => {
    // Score 0-0 (draw)
    // AH -0.25 splits into 0.0 (PUSH) and -0.5 (FULL_LOSS) -> HALF_LOSS
    const settled = settleAhBet({
      side: 'home',
      line: -0.25,
      homeScore: 0,
      awayScore: 0,
      odds: 1.95,
      stake: 1,
    });

    expect(settled.isQuarterLine).toBe(true);
    expect(settled.outcome).toBe('HALF_LOSS');
    expect(settled.settlementFraction).toBe(-0.5);
    expect(settled.pnl).toBe(-0.50);
  });

  it('retrieves match calculation trace from real dataset with non-empty explanation', () => {
    const res = AhHistoryService.queryObservations({ limit: 5 });
    expect(res.observations.length).toBeGreaterThan(0);

    const firstObs = res.observations[0];
    const trace = AhHistoryService.getMatchCalculationTrace(firstObs.observationId);

    expect(trace).not.toBeNull();
    expect(trace?.observationId).toBe(firstObs.observationId);
    expect(trace?.homeScore).toBe(firstObs.homeScore);
    expect(trace?.awayScore).toBe(firstObs.awayScore);
    expect(trace?.odds).toBe(firstObs.odds);
    expect(trace?.pnl).toBe(firstObs.pnl);
    expect(trace?.calculationExplanation).toBeDefined();
    expect(trace?.calculationExplanation.length).toBeGreaterThan(10);
  });
});
