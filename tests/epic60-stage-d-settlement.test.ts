// Test Suite for EPIC 60 Stage D — VOID Settlement Outcome & Denominator Exclusion
import { describe, it, expect } from 'vitest';
import {
  settleMoneyline,
  settleAsianHandicap,
  settleAsianTotal,
  settleBtts,
  profitOfOutcome,
  calculateSettlementPerformance,
  SettlementOutcome,
} from '../src/historical/settlement/settlement';
import { runSettlementBackfillScan } from '../src/lib/research/epic60-stage-d-void-backfill';

describe('EPIC 60 Stage D — VOID Outcome & Settlement Engine', () => {
  it('should return VOID when voided flag is set or scores are negative', () => {
    expect(settleMoneyline('home', 2, 1, true)).toBe('VOID');
    expect(settleAsianHandicap('home', -0.5, 2, 1, true)).toBe('VOID');
    expect(settleAsianTotal('over', 2.5, 3, true)).toBe('VOID');
    expect(settleBtts('yes', 1, 1, true)).toBe('VOID');

    expect(settleMoneyline('home', -1, 0)).toBe('VOID');
    expect(settleAsianHandicap('home', -0.5, 0, -1)).toBe('VOID');
  });

  it('should map VOID outcome to 0 profit', () => {
    expect(profitOfOutcome('VOID', 2.5, 1.0)).toBe(0);
    expect(profitOfOutcome('VOID', 3.0, 5.0)).toBe(0);
  });

  it('should strictly exclude VOID bets from win-rate and ROI denominators', () => {
    const testBets: Array<{ outcome: SettlementOutcome; stake: number; decimalOdds: number }> = [
      { outcome: 'WIN', stake: 1.0, decimalOdds: 2.0 },   // +1.0
      { outcome: 'LOSS', stake: 1.0, decimalOdds: 2.0 },  // -1.0
      { outcome: 'WIN', stake: 1.0, decimalOdds: 2.5 },   // +1.5
      { outcome: 'PUSH', stake: 1.0, decimalOdds: 2.0 },  // 0.0 (push)
      { outcome: 'VOID', stake: 1.0, decimalOdds: 3.0 },  // 0.0 (voided)
      { outcome: 'VOID', stake: 1.0, decimalOdds: 2.0 },  // 0.0 (voided)
    ];

    const perf = calculateSettlementPerformance(testBets);

    // Total bets: 6, Void bets: 2, Evaluated bets: 4
    expect(perf.totalBets).toBe(6);
    expect(perf.voidBets).toBe(2);
    expect(perf.evaluatedBets).toBe(4);

    // Total staked: 4 units (VOID stake refunded and NOT in denominator)
    expect(perf.totalStaked).toBe(4.0);
    // Total profit: 1.0 - 1.0 + 1.5 + 0 = 1.5
    expect(perf.totalProfit).toBe(1.5);
    // ROI = 1.5 / 4.0 * 100 = 37.5%
    expect(perf.roi).toBe(37.5);

    // Non-push bets: 3 (2 wins, 1 loss) -> hit rate = 2/3 * 100 = 66.67%
    expect(perf.hitRate).toBeCloseTo(66.67, 1);
  });

  it('should execute backfill scan on historical datasets and report counts', () => {
    const scan = runSettlementBackfillScan();
    expect(scan.datasetsAudited.canonicalEuropeMatches).toBeGreaterThan(8000);
    expect(scan.asianHandicapPushCount).toBeGreaterThan(0);
    expect(scan.misclassificationsFromEpic54).toBe(0);
  });
});
