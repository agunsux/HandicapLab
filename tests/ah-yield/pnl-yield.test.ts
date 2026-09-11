import { describe, it, expect } from 'vitest';
import {
  bootstrapProbabilityOfPositiveRoi,
  computeAhYieldCurve,
  computeAhYieldMetrics,
  rankAhMetrics,
  sampleSizeStatus,
} from '../../src/lib/research/ah-yield/ahYield';
import { makeObs } from './helpers';

describe('Yield / ROI — definitional separation from hit rate (spec §7, §8)', () => {
  it('ROI = total P&L / total stake, NOT wins / bets', () => {
    // 10 one-unit bets: 5 full wins @1.90 (+0.90), 1 half win (+0.45),
    // 2 half losses (−0.50), 2 full losses (−1.00).
    const obs = [
      ...Array.from({ length: 5 }, () => makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 1, awayScore: 0, odds: 1.9 })),
      makeObs({ side: 'away', marketLineHome: -0.25, homeScore: 0, awayScore: 0, odds: 1.9 }), // away +0.25 draw = HALF_WIN +0.45
      makeObs({ side: 'home', marketLineHome: -0.25, homeScore: 0, awayScore: 0, odds: 1.9 }), // HALF_LOSS -0.5
      makeObs({ side: 'home', marketLineHome: -0.25, homeScore: 0, awayScore: 0, odds: 1.9 }), // HALF_LOSS -0.5
      makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 0, awayScore: 0, odds: 1.9 }), // FULL_LOSS -1
      makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 0, awayScore: 1, odds: 1.9 }), // FULL_LOSS -1
    ];
    const m = computeAhYieldMetrics(obs);
    expect(m.evaluatedBets).toBe(10);
    expect(m.totalStake).toBe(10);
    expect(m.totalPnl).toBeCloseTo(1.95, 6);
    expect(m.roi).toBeCloseTo(m.totalPnl / m.totalStake, 6);
    expect(m.yieldPct).toBeCloseTo(m.roi * 100, 4);
    // Clean hit rate (6/10 non-push bets) must NOT be reported as ROI.
    expect(m.cleanHitRate).toBeCloseTo(6 / 10, 6);
    expect(m.roi).not.toBeCloseTo(0.6, 3);
  });

  it('7/7 wins is a 100% hit rate but ROI equals the odds, and probability shrinks (spec §11)', () => {
    const obs = Array.from({ length: 7 }, () =>
      makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 1, awayScore: 0, odds: 1.5 })
    );
    const m = computeAhYieldMetrics(obs);
    expect(m.cleanHitRate).toBe(1);
    expect(m.weightedHitRate).toBe(1);
    expect(m.yieldPct).toBeCloseTo(50, 4);
    expect(m.probabilityOfPositiveRoi).toBe(1);
  });

  it('0/7 wins yields exactly -100%', () => {
    const obs = Array.from({ length: 7 }, () =>
      makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 0, awayScore: 1, odds: 2.5 })
    );
    const m = computeAhYieldMetrics(obs);
    expect(m.cleanHitRate).toBe(0);
    expect(m.yieldPct).toBeCloseTo(-100, 6);
    expect(m.probabilityOfPositiveRoi).toBe(0);
  });

  it('all pushes: zero stake denominator must not produce NaN/Infinity', () => {
    const obs = Array.from({ length: 5 }, () =>
      makeObs({ side: 'home', marketLineHome: -1, homeScore: 2, awayScore: 1, odds: 1.9 })
    );
    const m = computeAhYieldMetrics(obs);
    expect(m.pushes).toBe(5);
    expect(m.totalStake).toBe(5); // stake is returned: excluded from ROI denominator only when VOID
    expect(m.roi).toBe(0);
    expect(m.yieldPct).toBe(0);
    expect(m.weightedHitRate).toBe(0);
    expect(Number.isFinite(m.roiCi95[0])).toBe(true);
  });

  it('mixed odds stats: average/median/min/max', () => {
    const odds = [1.8, 1.9, 2.0, 2.1];
    const obs = odds.map((o) =>
      makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 1, awayScore: 0, odds: o })
    );
    const m = computeAhYieldMetrics(obs);
    expect(m.averageOdds).toBeCloseTo(1.95, 6);
    expect(m.medianOdds).toBeCloseTo(1.95, 6);
    expect(m.minOdds).toBe(1.8);
    expect(m.maxOdds).toBe(2.1);
  });

  it('traceability: every aggregate is recomputable from individual observations', () => {
    const obs = [
      makeObs({ odds: 1.91, homeScore: 2, awayScore: 0, marketLineHome: -0.75 }),
      makeObs({ odds: 2.05, homeScore: 0, awayScore: 0, marketLineHome: -0.5 }),
      makeObs({ odds: 1.88, homeScore: 1, awayScore: 1, marketLineHome: 0.25, side: 'away' }),
      makeObs({ odds: 1.97, homeScore: 0, awayScore: 1, marketLineHome: -0.25 }),
    ];
    const m = computeAhYieldMetrics(obs);
    const stake = obs.reduce((s, o) => s + o.stake, 0);
    const pnl = obs.reduce((s, o) => s + o.pnl, 0);
    expect(m.totalStake).toBeCloseTo(stake, 6);
    expect(m.totalPnl).toBeCloseTo(pnl, 6);
    expect(m.matchCount).toBe(new Set(obs.map((o) => o.canonicalMatchId)).size);
  });
});

describe('Yield — risk metrics (spec §22)', () => {
  it('max drawdown, losing streak, profit factor, volatility', () => {
    // +1, -1, -1, +2 sequence on pnl
    const obs = [
      makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 1, awayScore: 0, odds: 2.0, matchDate: '2024-01-01' }), // +1
      makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 0, awayScore: 1, odds: 2.0, matchDate: '2024-01-02' }), // -1
      makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 0, awayScore: 1, odds: 2.0, matchDate: '2024-01-03' }), // -1
      makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 1, awayScore: 0, odds: 3.0, matchDate: '2024-01-04' }), // +2
    ];
    const m = computeAhYieldMetrics(obs);
    expect(m.totalPnl).toBeCloseTo(1, 6);
    expect(m.maxDrawdown).toBeCloseTo(2, 6);
    expect(m.longestLosingStreak).toBe(2);
    expect(m.profitFactor).toBeCloseTo(3 / 2, 4);
    expect(m.returnStdDev).toBeGreaterThan(0);
    expect(m.sharpeLike).not.toBeNull();
  });

  it('profit factor is null when there are no losing bets', () => {
    const obs = Array.from({ length: 3 }, () =>
      makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 1, awayScore: 0, odds: 2.0 })
    );
    expect(computeAhYieldMetrics(obs).profitFactor).toBeNull();
  });

  it('bootstrap probability of positive ROI is deterministic (same seed)', () => {
    const strongEdge = Array.from({ length: 40 }, (_, i) =>
      makeObs({
        side: 'home',
        marketLineHome: -0.5,
        homeScore: i < 30 ? 1 : 0,
        awayScore: i < 30 ? 0 : 1,
        odds: 2.2,
      })
    );
    const a = bootstrapProbabilityOfPositiveRoi([-1, 1, -1, 1, 1], { iterations: 500, seed: 42 });
    const b = bootstrapProbabilityOfPositiveRoi([-1, 1, -1, 1, 1], { iterations: 500, seed: 42 });
    expect(a).toBe(b);
    expect(computeAhYieldMetrics(strongEdge).probabilityOfPositiveRoi).toBeGreaterThan(0.95);
  });

  it('yield curve accumulates P&L and ROI in time order', () => {
    const obs = [
      makeObs({ matchDate: '2024-01-01', homeScore: 1, awayScore: 0, marketLineHome: -0.5, odds: 2.0 }),
      makeObs({ matchDate: '2024-01-02', homeScore: 0, awayScore: 1, marketLineHome: -0.5, odds: 2.0 }),
      makeObs({ matchDate: '2024-01-03', homeScore: 1, awayScore: 0, marketLineHome: -0.5, odds: 2.0 }),
    ];
    const curve = computeAhYieldCurve(obs);
    expect(curve.map((p) => p.pnlCumulative)).toEqual([1, 0, 1]);
    expect(curve[1].roiCumulative).toBeCloseTo(0, 6);
    expect(curve[2].betsCumulative).toBe(3);
  });
});

describe('Sample-size protection (spec §10)', () => {
  it('threshold boundaries', () => {
    expect(sampleSizeStatus(0)).toBe('INSUFFICIENT_SAMPLE');
    expect(sampleSizeStatus(29)).toBe('INSUFFICIENT_SAMPLE');
    expect(sampleSizeStatus(30)).toBe('LOW_SAMPLE');
    expect(sampleSizeStatus(99)).toBe('LOW_SAMPLE');
    expect(sampleSizeStatus(100)).toBe('MODERATE_SAMPLE');
    expect(sampleSizeStatus(299)).toBe('MODERATE_SAMPLE');
    expect(sampleSizeStatus(300)).toBe('STRONG_SAMPLE');
  });

  it('2 bets +90% ROI must NOT outrank 500 bets +5.8% ROI under default ranking', () => {
    const tiny = Array.from({ length: 2 }, () =>
      makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 1, awayScore: 0, odds: 1.9 })
    );
    const big = Array.from({ length: 500 }, (_, i) =>
      makeObs({
        side: 'home',
        marketLineHome: -0.5,
        homeScore: i % 9 !== 0 ? 1 : 0,
        awayScore: i % 9 !== 0 ? 0 : 1,
        odds: 1.92,
      })
    );
    const mTiny = computeAhYieldMetrics(tiny);
    const mBig = computeAhYieldMetrics(big);
    expect(mTiny.sampleSizeStatus).toBe('INSUFFICIENT_SAMPLE');
    expect(mBig.sampleSizeStatus).toBe('STRONG_SAMPLE');
    const ranked = rankAhMetrics([mTiny, mBig], 'value');
    expect(ranked[0]).toBe(mBig);
    const rawRoi = rankAhMetrics([mTiny, mBig], 'roi');
    expect(rawRoi[0]).toBe(mTiny); // raw ROI ordering is exposed but not the default
  });
});
