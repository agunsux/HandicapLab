// EPIC 56 — Asian Handicap Probability Models Engine (Optimized)
// Location: src/lib/research/ah-solo/ahProbabilityModels.ts

import {
  AhSide,
  CanonicalMatch,
  PointInTimeFootballState,
  GoalDifferencePmf,
  AhLineSettlementProbabilities,
} from './ahTypes';
import { isQuarterLine, getQuarterComponents } from './ahSettlementEngine';

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
}

export function dixonColesTau(x: number, y: number, lambda: number, mu: number, rho: number): number {
  if (x === 0 && y === 0) return Math.max(0, 1 - lambda * mu * rho);
  if (x === 1 && y === 0) return Math.max(0, 1 + mu * rho);
  if (x === 0 && y === 1) return Math.max(0, 1 + lambda * rho);
  if (x === 1 && y === 1) return Math.max(0, 1 - rho);
  return 1.0;
}

export class AhProbabilityModels {
  /**
   * Fit empirical rho parameter for Dixon-Coles model via Maximum Likelihood Estimation on training matches.
   */
  public static fitDixonColesRho(
    trainingMatches: CanonicalMatch[],
    getStateFn: (m: CanonicalMatch) => PointInTimeFootballState
  ): number {
    if (trainingMatches.length < 50) return -0.05;

    // Sample at most 1000 training matches for fast, reliable MLE fitting
    const sample = trainingMatches.length > 1000 ? trainingMatches.slice(-1000) : trainingMatches;

    // Precompute lambdas for the sample
    const precomputed = sample
      .filter((m) => m.homeGoals <= 8 && m.awayGoals <= 8)
      .map((m) => {
        const state = getStateFn(m);
        return {
          hg: m.homeGoals,
          ag: m.awayGoals,
          lh: state.expectedHomeGoals,
          la: state.expectedAwayGoals,
          pBase: poissonPmf(m.homeGoals, state.expectedHomeGoals) * poissonPmf(m.awayGoals, state.expectedAwayGoals),
        };
      });

    let bestRho = -0.05;
    let bestLogLikelihood = -Infinity;

    for (let r = -0.15; r <= 0.05; r += 0.02) {
      let ll = 0;
      for (let i = 0; i < precomputed.length; i++) {
        const item = precomputed[i];
        const tau = item.hg <= 1 && item.ag <= 1 ? dixonColesTau(item.hg, item.ag, item.lh, item.la, r) : 1.0;
        const prob = Math.max(1e-7, item.pBase * tau);
        ll += Math.log(prob);
      }

      if (ll > bestLogLikelihood) {
        bestLogLikelihood = ll;
        bestRho = Number(r.toFixed(3));
      }
    }

    return bestRho;
  }

  public static computePoissonMatrix(lambdaHome: number, lambdaAway: number, maxGoals = 8): number[][] {
    const matrix: number[][] = [];
    let sum = 0;

    for (let h = 0; h <= maxGoals; h++) {
      matrix[h] = [];
      for (let a = 0; a <= maxGoals; a++) {
        const p = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
        matrix[h][a] = p;
        sum += p;
      }
    }

    if (sum > 0) {
      for (let h = 0; h <= maxGoals; h++) {
        for (let a = 0; a <= maxGoals; a++) {
          matrix[h][a] /= sum;
        }
      }
    }

    return matrix;
  }

  public static computeDixonColesMatrix(
    lambdaHome: number,
    lambdaAway: number,
    rho: number,
    maxGoals = 8
  ): number[][] {
    const matrix: number[][] = [];
    let sum = 0;

    for (let h = 0; h <= maxGoals; h++) {
      matrix[h] = [];
      for (let a = 0; a <= maxGoals; a++) {
        const base = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
        const tau = h <= 1 && a <= 1 ? dixonColesTau(h, a, lambdaHome, lambdaAway, rho) : 1.0;
        const p = Math.max(0, base * tau);
        matrix[h][a] = p;
        sum += p;
      }
    }

    if (sum > 0) {
      for (let h = 0; h <= maxGoals; h++) {
        for (let a = 0; a <= maxGoals; a++) {
          matrix[h][a] /= sum;
        }
      }
    }

    return matrix;
  }

  public static matrixToGoalDifferencePmf(matrix: number[][]): GoalDifferencePmf {
    const pmf: Record<number, number> = {};
    let expectedGd = 0;

    const maxGoals = matrix.length - 1;
    for (let gd = -maxGoals; gd <= maxGoals; gd++) {
      pmf[gd] = 0;
    }

    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        const p = matrix[h][a];
        const gd = h - a;
        pmf[gd] = (pmf[gd] || 0) + p;
        expectedGd += gd * p;
      }
    }

    let totalP = 0;
    for (const val of Object.values(pmf)) totalP += val;
    if (totalP > 0) {
      for (const k of Object.keys(pmf)) {
        pmf[Number(k)] = Number((pmf[Number(k)] / totalP).toFixed(6));
      }
    }

    return {
      pmf,
      expectedGd: Number(expectedGd.toFixed(4)),
    };
  }

  public static deriveAhSettlementProbabilities(
    gdPmf: GoalDifferencePmf,
    line: number,
    side: AhSide
  ): AhLineSettlementProbabilities {
    let pFullWin = 0;
    let pHalfWin = 0;
    let pPush = 0;
    let pHalfLoss = 0;
    let pFullLoss = 0;

    const isQuarter = isQuarterLine(line);

    for (const [gdStr, prob] of Object.entries(gdPmf.pmf)) {
      if (prob <= 0) continue;
      const homeAwayGd = Number(gdStr);
      const sideGd = side === 'home' ? homeAwayGd : -homeAwayGd;

      if (isQuarter) {
        const [l1, l2] = getQuarterComponents(line);
        const m1 = sideGd + l1;
        const m2 = sideGd + l2;

        const w1 = m1 > 1e-6 ? 1 : m1 < -1e-6 ? -1 : 0;
        const w2 = m2 > 1e-6 ? 1 : m2 < -1e-6 ? -1 : 0;

        if (w1 === 1 && w2 === 1) pFullWin += prob;
        else if (w1 === -1 && w2 === -1) pFullLoss += prob;
        else if (w1 === 0 && w2 === 0) pPush += prob;
        else if ((w1 === 1 && w2 === 0) || (w1 === 0 && w2 === 1)) pHalfWin += prob;
        else if ((w1 === -1 && w2 === 0) || (w1 === 0 && w2 === -1)) pHalfLoss += prob;
        else pPush += prob;
      } else {
        const margin = sideGd + line;
        if (margin > 1e-6) pFullWin += prob;
        else if (margin < -1e-6) pFullLoss += prob;
        else pPush += prob;
      }
    }

    const pCover = pFullWin + 0.5 * pHalfWin;
    const winNumerator = pFullWin + 0.5 * pHalfWin;
    const lossDenominator = pFullLoss + 0.5 * pHalfLoss;
    const fairOdds = winNumerator > 0 ? (winNumerator + lossDenominator) / winNumerator : 999.0;

    return {
      line,
      side,
      pFullWin: Number(pFullWin.toFixed(4)),
      pHalfWin: Number(pHalfWin.toFixed(4)),
      pPush: Number(pPush.toFixed(4)),
      pHalfLoss: Number(pHalfLoss.toFixed(4)),
      pFullLoss: Number(pFullLoss.toFixed(4)),
      pCover: Number(pCover.toFixed(4)),
      fairOdds: Number(Math.max(1.01, Math.min(100.0, fairOdds)).toFixed(4)),
    };
  }
}
