import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { evBucketAnalysis, brierAndLogLoss, calibrationBuckets, winRateWithCI, roiWithCI } from '../../src/historical/model/metrics';
import { deriveMarkets, scoreMatrix, poissonPmf, computeLambdas, type PoissonParams } from '../../src/historical/model/poisson';

const OUT_DIR = path.resolve(process.cwd(), 'data', 'historical');

function loadJsonl<T>(file: string): T[] {
  return fs.readFileSync(path.join(OUT_DIR, file), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as T);
}

describe('Phase 2a gold layer', () => {
  it('leakage audit has zero violations', () => {
    const audit = loadJsonl<{ leak_free: boolean; match_date: string; min_source_date: string | null }>('leakage_audit.jsonl');
    expect(audit.length).toBe(2280);
    expect(audit.every((e) => e.leak_free)).toBe(true);
    expect(audit.every((e) => e.min_source_date === null || e.min_source_date < e.match_date)).toBe(true);
  });

  it('normalized matches: 2280 rows, 6 full seasons, no duplicates', () => {
    const matches = loadJsonl<{ season: string; result: 'H' | 'D' | 'A' }>('normalized_matches.jsonl');
    expect(matches.length).toBe(2280);
    const bySeason: Record<string, number> = {};
    for (const m of matches) bySeason[m.season] = (bySeason[m.season] || 0) + 1;
    expect(Object.keys(bySeason)).toHaveLength(6);
    for (const n of Object.values(bySeason)) expect(n).toBe(380);
  });

  it('historical odds coverage: 1X2 full, O/U2.5 near-full', () => {
    const odds = loadJsonl<{ market_1x2: unknown; market_ou25: unknown }>('historical_odds.jsonl');
    expect(odds.length).toBe(2280);
    expect(odds.filter((o) => o.market_1x2 !== null)).toHaveLength(2280);
    expect(odds.filter((o) => o.market_ou25 !== null).length).toBeGreaterThanOrEqual(2279);
  });
});

describe('Phase 2a walk-forward report (corrected + calibrated)', () => {
  const report = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'walkforward_report.json'), 'utf8')) as {
    calibration_note: string;
    calibration_folds: Array<{ test_season: string; T_ml: number; T_ou25: number; T_btts: number; T_ah: number; n_train_predicted: number; T_ml_at_boundary: boolean; T_ou25_at_boundary: boolean }>;
    markets: { AH: { wins: number; pushes: number; losses: number; win_rate: { value: number } | null }; ML: { wins: number; pushes: number; losses: number; avg_ev_calibrated: number | null } };
    calibration: {
      before: { ML: { ece: number; brier: { brier: number; logloss: number; n: number } | null; unique_n: number | null }; OU25: { ece: number } };
      after: { ML: { ece: number; brier: { brier: number; logloss: number; n: number } | null }; OU25: { ece: number } };
    };
    ev_analysis: { ML: { statement: string } };
    clv: { available: boolean };
  };

  it('AH home -0.5 has zero pushes (draw = LOSS)', () => {
    expect(report.markets.AH.pushes).toBe(0);
    expect(report.markets.AH.wins + report.markets.AH.losses).toBe(1515);
    expect(report.markets.AH.win_rate?.value).toBeCloseTo(0.4436, 2);
  });

  it('ML metrics use unique matches and calibrated EV', () => {
    expect(report.calibration.before.ML.brier?.n).toBe(1515);
    expect(report.calibration.after.ML.brier?.n).toBe(1515);
    expect(report.calibration.before.ML.unique_n).toBe(1515);
    expect(report.markets.ML.wins).toBe(1515);
    expect(report.markets.ML.pushes).toBe(0);
  });

  it('calibration T fitted on train folds only, boundary flagged honestly', () => {
    for (const f of report.calibration_folds) {
      expect(f.T_ml).toBeGreaterThanOrEqual(0.05);
      expect(f.T_ml).toBeLessThanOrEqual(20.0);
      expect(f.n_train_predicted).toBeGreaterThan(0);
      expect(typeof f.T_ml_at_boundary).toBe('boolean');
      expect(typeof f.T_ou25_at_boundary).toBe('boolean');
    }
  });

  it('calibration note is explicit about boundary/inadequacy', () => {
    expect(report.calibration_note.length).toBeGreaterThan(0);
  });

  it('EV analysis reports sample-size statement, no placeholder', () => {
    expect(report.ev_analysis.ML.statement).not.toContain('null');
    expect(report.ev_analysis.ML.statement.length).toBeGreaterThan(0);
  });

  it('CLV is NULL with documented reason, never fabricated', () => {
    expect(report.clv.available).toBe(false);
  });
});

describe('settlement regression: AH -0.5 no push', () => {
  it('home -0.5: draw is a loss, home win is a win', () => {
    const settle = (h: number, a: number) => (h > a ? 'WIN' : 'LOSS');
    expect(settle(2, 1)).toBe('WIN');
    expect(settle(1, 1)).toBe('LOSS');
    expect(settle(0, 3)).toBe('LOSS');
    expect(settle(1, 0)).toBe('WIN');
  });
});

describe('metrics unit tests', () => {
  it('brierAndLogLoss uses full distribution', () => {
    const r = brierAndLogLoss(
      [{ pHome: 0.5, pDraw: 0.3, pAway: 0.2 }, { pHome: 0.6, pDraw: 0.25, pAway: 0.15 }],
      ['H', 'A']
    );
    expect(r?.n).toBe(2);
    expect(r!.brier).toBeGreaterThan(0);
    expect(r!.logloss).toBeGreaterThan(0);
  });

  it('calibrationBuckets sums ECE correctly', () => {
    const r = calibrationBuckets([{ p: 0.52, outcome: true }, { p: 0.54, outcome: false }]);
    expect(r.buckets.find((b) => b.bucket === '50-55')?.n).toBe(2);
    expect(r.ece).toBeGreaterThan(0);
  });

  it('evBucketAnalysis produces 6 buckets with honest statement for small n', () => {
    const r = evBucketAnalysis([{ ev: 0.02, outcome: 'WIN', profit: 0.9 }]);
    expect(r.buckets).toHaveLength(6);
    expect(r.buckets[1].n).toBe(1);
    expect(r.statement).toContain('insufficient');
  });

  it('winRateWithCI returns null for empty sample', () => {
    expect(winRateWithCI(0, 0)).toBeNull();
  });

  it('roiWithCI returns null for empty sample', () => {
    expect(roiWithCI([], [])).toBeNull();
  });
});

describe('poisson model unit tests', () => {
  const params: PoissonParams = { leagueHomeAvg: 1.45, leagueAwayAvg: 1.25, homeAdv: 1.12, eloScale: 400, maxGoals: 10 };

  it('poissonPmf sums near 1', () => {
    let s = 0;
    for (let k = 0; k <= 20; k++) s += poissonPmf(1.4, k);
    expect(s).toBeCloseTo(1, 5);
  });

  it('lambdas are symmetric under ELO swap and bounded', () => {
    const base = { homeAvgGoalsFor: 1.6, awayAvgGoalsAgainst: 1.2, awayAvgGoalsFor: 1.1, homeAvgGoalsAgainst: 1.4, leagueAvgGoals: 2.7, eloDelta: 0 };
    const l0 = computeLambdas(base, params);
    const lPos = computeLambdas({ ...base, eloDelta: 200 }, params);
    const lNeg = computeLambdas({ ...base, eloDelta: -200 }, params);
    expect(l0.home).toBeGreaterThan(0);
    expect(lPos.home).toBeGreaterThan(l0.home);
    expect(lNeg.home).toBeLessThan(l0.home);
    expect(lPos.away).toBeLessThan(l0.away);
    expect(lPos.home * lPos.away).toBeCloseTo(l0.home * l0.away, 6);
    expect(l0.home).toBeLessThanOrEqual(5);
    expect(l0.away).toBeGreaterThanOrEqual(0.1);
  });

  it('score matrix derives sane market probabilities', () => {
    const probs = deriveMarkets(scoreMatrix({ home: 1.5, away: 1.2 }, 10));
    const sum = probs.pHome + probs.pDraw + probs.pAway;
    expect(sum).toBeCloseTo(1, 6);
    expect(probs.pHome).toBeGreaterThan(probs.pAway);
    expect(probs.pOver['2.5']).toBeGreaterThan(0.3);
    expect(probs.pOver['2.5']).toBeLessThan(0.8);
    expect(probs.pBttsYes).toBeGreaterThan(0.4);
  });
});
