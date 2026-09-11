import { describe, it, expect } from 'vitest';
import {
  devigOneXTwo,
  devigTwoWay,
  fitIndependencePoissonToOutcomes,
  goalDifferencePmf,
  outcomeProbabilitiesFromPmf,
  poissonPmf,
  settlementProbabilitiesFromPmf,
  type AhCategoryProbabilities,
} from '../../src/lib/research/ah-edge/edgeProbability';
import { isValidHandicapLine, settleAhBet } from '../../src/lib/research/ah-yield/ahSettlement';

describe('AH edge probability math', () => {
  it('poisson pmf is a valid distribution', () => {
    let sum = 0;
    for (let k = 0; k <= 30; k++) sum += poissonPmf(k, 1.7);
    expect(sum).toBeCloseTo(1, 6);
    expect(poissonPmf(-1, 1.7)).toBe(0);
    expect(poissonPmf(0, 1.7)).toBeCloseTo(Math.exp(-1.7), 10);
  });

  it('goal-difference pmf sums to 1 and matches manual convolution', () => {
    const pmf = goalDifferencePmf(1.6, 1.1);
    const sum = Object.values(pmf).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 9);
    // P(GD=0) = sum_k P_h(k)P_a(k)
    let p0 = 0;
    for (let k = 0; k <= 15; k++) p0 += poissonPmf(k, 1.6) * poissonPmf(k, 1.1);
    expect(pmf[0]).toBeCloseTo(p0, 9);
  });

  it('degenerate pmf categories match the validated settlement engine on a full grid', () => {
    for (let line = -3; line <= 3.0001; line += 0.25) {
      const l = Math.round(line * 100) / 100;
      if (!isValidHandicapLine(l)) continue;
      for (let gd = -4; gd <= 4; gd++) {
        const pmf: Record<number, number> = { [gd]: 1 };
        const h = gd >= 0 ? gd : 0;
        const a = gd >= 0 ? 0 : -gd;
        for (const side of ['home', 'away'] as const) {
          const probs = settlementProbabilitiesFromPmf(pmf, l, side);
          const selectionLine = side === 'home' ? l : -l;
          const settled = settleAhBet({ side, line: selectionLine, homeScore: h, awayScore: a, odds: 1.9 });
          const expected: AhCategoryProbabilities =
            settled.outcome === 'FULL_WIN'
              ? { pFullWin: 1, pHalfWin: 0, pPush: 0, pHalfLoss: 0, pFullLoss: 0 }
              : settled.outcome === 'HALF_WIN'
                ? { pFullWin: 0, pHalfWin: 1, pPush: 0, pHalfLoss: 0, pFullLoss: 0 }
                : settled.outcome === 'PUSH'
                  ? { pFullWin: 0, pHalfWin: 0, pPush: 1, pHalfLoss: 0, pFullLoss: 0 }
                  : settled.outcome === 'HALF_LOSS'
                    ? { pFullWin: 0, pHalfWin: 0, pPush: 0, pHalfLoss: 1, pFullLoss: 0 }
                    : { pFullWin: 0, pHalfWin: 0, pPush: 0, pHalfLoss: 0, pFullLoss: 1 };
          expect(probs.pFullWin).toBeCloseTo(expected.pFullWin, 9);
          expect(probs.pHalfWin).toBeCloseTo(expected.pHalfWin, 9);
          expect(probs.pPush).toBeCloseTo(expected.pPush, 9);
          expect(probs.pHalfLoss).toBeCloseTo(expected.pHalfLoss, 9);
          expect(probs.pFullLoss).toBeCloseTo(expected.pFullLoss, 9);
          // Sum of probabilities is exactly 1.
          const total = probs.pFullWin + probs.pHalfWin + probs.pPush + probs.pHalfLoss + probs.pFullLoss;
          expect(total).toBeCloseTo(1, 9);
        }
      }
    }
  });

  it('quarter-line split is preserved for real pmfs', () => {
    const pmf = goalDifferencePmf(1.4, 1.2);
    for (const line of [-2.75, -2.25, -1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75, 2.25, 2.75]) {
      const probs = settlementProbabilitiesFromPmf(pmf, line, 'home');
      const total = probs.pFullWin + probs.pHalfWin + probs.pPush + probs.pHalfLoss + probs.pFullLoss;
      expect(total).toBeCloseTo(1, 9);
      // A quarter line can never be a full push and always has half-win + half-loss mass.
      expect(probs.pHalfWin + probs.pHalfLoss).toBeGreaterThan(0);
      expect(probs.pPush).toBe(0);
    }
  });

  it('outcome probabilities from pmf sum to 1 and are ordered correctly', () => {
    const pmf = goalDifferencePmf(2.0, 0.8);
    const { pHome, pDraw, pAway } = outcomeProbabilitiesFromPmf(pmf);
    expect(pHome + pDraw + pAway).toBeCloseTo(1, 9);
    expect(pHome).toBeGreaterThan(pAway);
  });

  it('Poisson fit recovers known rates and achieves tiny squared error', () => {
    const trueRates = { lambdaHome: 1.6, lambdaAway: 1.1 };
    const target = outcomeProbabilitiesFromPmf(goalDifferencePmf(trueRates.lambdaHome, trueRates.lambdaAway));
    const fit = fitIndependencePoissonToOutcomes(target);
    expect(fit.squaredError).toBeLessThan(1e-4);
    expect(Math.abs(fit.lambdaHome - trueRates.lambdaHome)).toBeLessThan(0.06);
    expect(Math.abs(fit.lambdaAway - trueRates.lambdaAway)).toBeLessThan(0.06);
  });

  it('devig helpers are proportional and valid', () => {
    const oneXTwo = devigOneXTwo(2.0, 3.4, 3.8);
    expect(oneXTwo.pHome + oneXTwo.pDraw + oneXTwo.pAway).toBeCloseTo(1, 10);
    const two = devigTwoWay(1.9, 1.9);
    expect(two.pA).toBeCloseTo(0.5, 10);
    expect(() => devigOneXTwo(1.0, 3.4, 3.8)).toThrow();
    expect(() => devigTwoWay(1.9, 0.5)).toThrow();
  });
});
