import { describe, it, expect } from 'vitest';
import {
  ahExpectedValue,
  ahFairOdds,
  ahPriceEdge,
  assessAhBet,
  devigTwoWay,
  type AhSettlementProbabilities,
} from '../../src/lib/research/ah-yield/ahFairOdds';

const probs = (p: Partial<AhSettlementProbabilities>): AhSettlementProbabilities => ({
  pFullWin: 0,
  pHalfWin: 0,
  pPush: 0,
  pHalfLoss: 0,
  pFullLoss: 0,
  ...p,
});

describe('Fair odds and EV — settlement-aware, never binary 1/p (spec §12, §13)', () => {
  it('binary case reduces to fair odds 1/p (sanity check)', () => {
    const p = probs({ pFullWin: 0.5, pFullLoss: 0.5 });
    expect(ahFairOdds(p)).toBeCloseTo(2.0, 10);
    expect(ahExpectedValue(p, 2.0)).toBeCloseTo(0, 10);
  });

  it('quarter-line distribution: fair odds are NOT 1/pCover', () => {
    const p = probs({ pFullWin: 0.3, pHalfWin: 0.2, pPush: 0.1, pHalfLoss: 0.2, pFullLoss: 0.2 });
    const fair = ahFairOdds(p);
    expect(fair).not.toBeNull();
    const naiveBinary = 1 / (p.pFullWin + p.pHalfWin + p.pPush);
    expect(fair as number).not.toBeCloseTo(naiveBinary, 3);
    // Exact solution of EV = 0.
    expect(ahExpectedValue(p, fair as number)).toBeCloseTo(0, 10);
  });

  it('EV increases monotonically with odds; positive iff odds > fair', () => {
    const p = probs({ pFullWin: 0.25, pHalfWin: 0.25, pPush: 0.1, pHalfLoss: 0.25, pFullLoss: 0.15 });
    const fair = ahFairOdds(p) as number;
    expect(ahExpectedValue(p, fair - 0.05)).toBeLessThan(0);
    expect(ahExpectedValue(p, fair + 0.05)).toBeGreaterThan(0);
    expect(ahExpectedValue(p, fair)).toBeCloseTo(0, 9);
  });

  it('half-win/half-loss settlement is priced exactly', () => {
    // 100% half win at odds o => pnl = 0.5(o-1) always > 0; fair odds = 1.
    const p = probs({ pHalfWin: 1 });
    expect(ahFairOdds(p)).toBeCloseTo(1, 10);
    expect(ahExpectedValue(p, 1.9)).toBeCloseTo(0.45, 10);
  });

  it('fair odds undefined when no profit outcome is possible', () => {
    expect(ahFairOdds(probs({ pFullLoss: 1 }))).toBeNull();
  });

  it('price edge = offered/fair - 1', () => {
    expect(ahPriceEdge(2.1, 2.0)).toBeCloseTo(0.05, 10);
    expect(ahPriceEdge(2.0, null)).toBeNull();
  });

  it('proportional two-way devig', () => {
    const d = devigTwoWay(1.9, 1.9);
    expect(d.pA).toBeCloseTo(0.5, 10);
    expect(d.fairA).toBeCloseTo(2.0, 10);
    expect(d.overround).toBeCloseTo(2 / 1.9 - 1, 10);
    const d2 = devigTwoWay(1.5, 3.0);
    // pA = (1/1.5)/(1/1.5+1/3) = 0.6667/1 = 0.6667
    expect(d2.pA).toBeCloseTo(2 / 3, 10);
    expect(d2.pB).toBeCloseTo(1 / 3, 10);
    expect(d2.pA + d2.pB).toBeCloseTo(1, 10);
  });

  it('assess: edge = model EV − market implied EV, and edge is null without opposite price', () => {
    const p = probs({ pFullWin: 0.55, pFullLoss: 0.45 });
    const withPair = assessAhBet(p, 2.0, 1.9);
    expect(withPair.modelEv).toBeCloseTo(0.1, 6);
    expect(withPair.marketImpliedEv).not.toBeNull();
    expect(withPair.edge).toBeCloseTo(withPair.modelEv - (withPair.marketImpliedEv as number), 6);

    const noPair = assessAhBet(p, 2.0, null);
    expect(noPair.edge).toBeNull();
    expect(noPair.marketImpliedEv).toBeNull();
  });

  it('throws on invalid offered odds', () => {
    const p = probs({ pFullWin: 0.5, pFullLoss: 0.5 });
    expect(() => ahExpectedValue(p, 1.0)).toThrow();
    expect(() => ahExpectedValue(p, -1)).toThrow();
    expect(() => devigTwoWay(1.0, 1.9)).toThrow();
  });
});
