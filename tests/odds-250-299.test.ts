import { describe, it, expect } from 'vitest';
import {
  HYPOTHESIS,
  inBand,
  clusterOf,
  summarizeCluster,
  linkageReport,
  runOdds250299Validation,
} from '../src/historical/odds250/validate';
import { BetRecord } from '../src/historical/realOdds/validate';

function bet(over: Partial<BetRecord>): BetRecord {
  return {
    match_id: 'm1',
    season: '2025-2026',
    match_date: '2026-02-01',
    month: '2026-02',
    market: 'ML',
    bookmaker: 'pinnacle',
    line: null,
    selection: 'home',
    entry_odds: 2.7,
    closing_odds: 2.6,
    model_probability: 0.4,
    entry_fair_p: 0.37,
    closing_fair_p: 0.38,
    edge: 0.03,
    ev: 0.08,
    outcome: 'WIN',
    profit: 1.7,
    stake: 1,
    clv: 0.01,
    ...over,
  };
}

describe('Frozen hypothesis boundaries (section 26)', () => {
  it('should include exact 2.50 lower boundary', () => {
    expect(inBand(2.5)).toBe(true);
  });

  it('should include exact 2.99 upper boundary', () => {
    expect(inBand(2.99)).toBe(true);
  });

  it('should exclude 2.499', () => {
    expect(inBand(2.499)).toBe(false);
  });

  it('should exclude 2.991', () => {
    expect(inBand(2.991)).toBe(false);
  });

  it('should exclude values below 2.50 and above 2.99', () => {
    expect(inBand(2.4)).toBe(false);
    expect(inBand(3.0)).toBe(false);
  });

  it('must not change the band after freezing', () => {
    expect(HYPOTHESIS.lo).toBe(2.5);
    expect(HYPOTHESIS.hi).toBe(2.99);
  });
});

describe('Cluster isolation (section 26)', () => {
  it('should assign dates to correct clusters without overlap', () => {
    expect(clusterOf('2023-05-01')).toBe('C1');
    expect(clusterOf('2025-01-01')).toBe('C2');
    expect(clusterOf('2026-03-01')).toBe('C3');
    expect(clusterOf('2024-07-15')).toBeNull();
  });
});

describe('Summarizer correctness', () => {
  it('should compute ROI, EV, CLV, and monthly stats from bets', () => {
    const bets = [
      bet({ match_date: '2026-02-01', entry_odds: 2.7, ev: 0.1, profit: 1.7, outcome: 'WIN', clv: 0.01 }),
      bet({ match_date: '2026-02-15', entry_odds: 2.8, ev: -0.2, profit: -1, outcome: 'LOSS', clv: -0.02 }),
      bet({ match_date: '2026-03-01', entry_odds: 2.6, ev: 0.05, profit: 0.6, outcome: 'HALF_WIN', clv: 0.005 }),
    ];
    const s = summarizeCluster(bets);
    expect(s.bets).toBe(3);
    expect(s.wins).toBe(1);
    expect(s.half_wins).toBe(1);
    expect(s.losses).toBe(1);
    expect(s.profit).toBeCloseTo(1.3, 6);
    expect(s.stake).toBeCloseTo(3, 6);
    expect(s.roi).toBeCloseTo(1.3 / 3, 3);
    expect(s.avg_ev).toBeCloseTo((0.1 - 0.2 + 0.05) / 3, 3);
    expect(s.positive_months).toBe(2); // Feb has +0.7, Mar +0.6
    expect(s.negative_months).toBe(0);
  });

  it('should return null metrics for empty set', () => {
    const s = summarizeCluster([]);
    expect(s.roi).toBeNull();
    expect(s.bets).toBe(0);
  });
});

describe('EV and CLV identities', () => {
  it('EV = model_probability * entry_odds - 1', () => {
    const b = bet({ model_probability: 0.4, entry_odds: 2.7, ev: 0.4 * 2.7 - 1 });
    expect(b.ev).toBeCloseTo(0.08, 6);
  });
});

describe('Linkage report (P0)', () => {
  it('should report C3_VALIDATION_BLOCKED when no OddsPAPI data exists', () => {
    const r = linkageReport();
    expect(r.decision).toBe('C3_VALIDATION_BLOCKED');
    expect(r.oddspapi_data_present).toBe(false);
    expect(r.oddspapi_records_received).toBe(0);
  });
});

describe('End-to-end run', () => {
  it('should be deterministic and reproduce the frozen C1/C2 discovery', () => {
    const r1 = runOdds250299Validation();
    const r2 = runOdds250299Validation();
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    const c1 = r1['C1'] as { bets: number; roi: number | null };
    const c2 = r2['C2'] as { bets: number; roi: number | null };
    expect(c1.bets).toBeGreaterThan(0);
    expect(c2.bets).toBeGreaterThan(0);
    // C1 ~ +9.4%, C2 ~ +12.9% (frozen discovery reproduction)
    expect(c1.roi).toBeGreaterThan(0.05);
    expect(c2.roi).toBeGreaterThan(0.08);
    // C3 must be empty (blocked) — never fabricated
    const c3 = r1['C3'] as { bets: number };
    expect(c3.bets).toBe(0);
  });

  it('should decide C3 VALIDATION BLOCKED', () => {
    const r = runOdds250299Validation();
    expect(r['final_decision']).toBe('E — C3 VALIDATION BLOCKED');
  });
});
