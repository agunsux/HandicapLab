import { describe, it, expect } from 'vitest';
import {
  betaCredibleInterval,
  betaQuantile,
  fitAhPosterior,
  fitBinaryPositiveReturnPosterior,
  regularizedIncompleteBeta,
  SETTLEMENT_CATEGORIES,
} from '../../src/lib/research/ah-yield/ahProbability';
import { makeObs } from './helpers';

function wins(n: number) {
  return Array.from({ length: n }, () =>
    makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 1, awayScore: 0, odds: 1.9 })
  );
}
function losses(n: number) {
  return Array.from({ length: n }, () =>
    makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 0, awayScore: 1, odds: 1.9 })
  );
}
function pushes(n: number) {
  return Array.from({ length: n }, () =>
    makeObs({ side: 'home', marketLineHome: -1, homeScore: 2, awayScore: 1, odds: 1.9 })
  );
}

describe('Probability — Bayesian shrinkage, never certainty (spec §11)', () => {
  it('7/7 wins does NOT imply true probability 1.0', () => {
    const p = fitBinaryPositiveReturnPosterior(wins(7));
    expect(p.decisions).toBe(7);
    expect(p.probability).toBeCloseTo(8 / 9, 6);
    expect(p.probability).toBeLessThan(1);
    expect(p.ci95[0]).toBeGreaterThan(0.5);
    expect(p.ci95[1]).toBeLessThan(1);
  });

  it('0/7 wins does NOT imply probability 0', () => {
    const p = fitBinaryPositiveReturnPosterior(losses(7));
    expect(p.probability).toBeCloseTo(1 / 9, 6);
    expect(p.probability).toBeGreaterThan(0);
    expect(p.ci95[0]).toBeGreaterThan(0);
  });

  it('pushes are excluded from the binary decisions', () => {
    const p = fitBinaryPositiveReturnPosterior([...wins(3), ...pushes(10)]);
    expect(p.wins).toBe(3);
    expect(p.decisions).toBe(3);
    expect(p.probability).toBeCloseTo(4 / 5, 6);
  });

  it('50/50 large sample stays near 0.5 and intervals narrow with N', () => {
    const small = fitBinaryPositiveReturnPosterior([...wins(25), ...losses(25)]);
    const large = fitBinaryPositiveReturnPosterior([...wins(500), ...losses(500)]);
    expect(small.probability).toBeCloseTo(0.5, 1);
    expect(large.probability).toBeCloseTo(0.5, 2);
    const smallWidth = small.ci95[1] - small.ci95[0];
    const largeWidth = large.ci95[1] - large.ci95[0];
    expect(largeWidth).toBeLessThan(smallWidth);
  });

  it('Dirichlet posterior over the 5 settlement categories sums to 1', () => {
    const obs = [...wins(4), ...losses(2), ...pushes(3)];
    const post = fitAhPosterior(obs);
    const total =
      post.pFullWin + post.pHalfWin + post.pPush + post.pHalfLoss + post.pFullLoss;
    expect(total).toBeCloseTo(1, 10);
    expect(post.n).toBe(9);
    expect(post.counts.FULL_WIN).toBe(4);
    expect(post.counts.PUSH).toBe(3);
  });

  it('no observations → uniform 0.2 prior, wide intervals', () => {
    const post = fitAhPosterior([]);
    for (const c of SETTLEMENT_CATEGORIES) {
      expect(post[c === 'FULL_WIN' ? 'pFullWin' : c === 'HALF_WIN' ? 'pHalfWin' : c === 'PUSH' ? 'pPush' : c === 'HALF_LOSS' ? 'pHalfLoss' : 'pFullLoss']).toBeCloseTo(0.2, 10);
    }
    const [lo, hi] = post.credibleIntervals.FULL_WIN;
    expect(hi - lo).toBeGreaterThan(0.5);
  });

  it('VOID observations never enter the posterior', () => {
    const base = makeObs({ side: 'home', marketLineHome: -0.5, homeScore: 1, awayScore: 0 });
    const withVoid = { ...base, settlement: 'VOID' as const, pnl: 0, settlementFraction: 0 };
    const post = fitAhPosterior([...wins(9), withVoid]);
    expect(post.n).toBe(9);
  });

  it('beta functions are numerically sound', () => {
    expect(regularizedIncompleteBeta(0.5, 1, 1)).toBeCloseTo(0.5, 10);
    expect(betaQuantile(0.5, 2, 2)).toBeCloseTo(0.5, 6);
    const [lo, hi] = betaCredibleInterval(5, 10, 1, 1, 0.95);
    expect(lo).toBeLessThan(0.5);
    expect(hi).toBeGreaterThan(0.5);
    expect(hi - lo).toBeGreaterThan(0.2);
    expect(hi - lo).toBeLessThan(0.65);
  });
});
