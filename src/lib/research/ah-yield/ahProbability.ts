// AH YIELD ENGINE — Probability estimation.
//
// Observed hit rate is NOT the true probability. Each (line, side) posterior is
// a Dirichlet-multinomial (the 5-category generalisation of Beta-Binomial) over
// the actual AH settlement categories {FULL_WIN, HALF_WIN, PUSH, HALF_LOSS,
// FULL_LOSS}, plus a Beta-Binomial for the binary "positive return among
// decided bets" event (pushes excluded).
//
// Posterior mean:        p_i = (α_i + c_i) / (Σα + n)
// Marginal 95% CI:       Beta(α_i, Σα − α_i) quantiles
// Binary positive-return: Beta(1 + w, 1 + d − w), d = decided bets, w = FW + HW

import type { AhBetObservation } from './ahTypes';

export const SETTLEMENT_CATEGORIES = ['FULL_WIN', 'HALF_WIN', 'PUSH', 'HALF_LOSS', 'FULL_LOSS'] as const;
export type SettlementCategory = (typeof SETTLEMENT_CATEGORIES)[number];

export interface AhDirichletPosterior {
  n: number;
  counts: Record<SettlementCategory, number>;
  alphaPrior: number[];
  alphaPosterior: number[];
  pFullWin: number;
  pHalfWin: number;
  pPush: number;
  pHalfLoss: number;
  pFullLoss: number;
  /** P(any positive settlement) = pFW + pHW */
  pProfit: number;
  /** P(not a total loss) = pFW + pHW + pPush */
  pCoverOrPush: number;
  /** E[s] = pFW + 0.5·pHW − 0.5·pHL − pFL */
  expectedSettleScore: number;
  /** Marginal 95% credible intervals for each category. */
  credibleIntervals: Record<SettlementCategory, [number, number]>;
}

export interface AhBinaryPosterior {
  wins: number;
  decisions: number;
  /** (wins + 1) / (decisions + 2) */
  probability: number;
  ci95: [number, number];
}

function logGamma(z: number): number {
  // Lanczos approximation (deterministic, double precision).
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Regularized incomplete beta I_x(a,b) via continued fraction. */
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b);
  const front = Math.exp(lbeta + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (aa: number, bb: number, xx: number): number => {
    const maxIter = 200;
    const eps = 3e-12;
    const fpmin = 1e-300;
    const qab = aa + bb;
    const qap = aa + 1;
    const qam = aa - 1;
    let c = 1;
    let d = 1 - (qab * xx) / qap;
    if (Math.abs(d) < fpmin) d = fpmin;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= maxIter; m++) {
      const m2 = 2 * m;
      let aa2 = (m * (bb - m) * xx) / ((qam + m2) * (aa + m2));
      d = 1 + aa2 * d;
      if (Math.abs(d) < fpmin) d = fpmin;
      c = 1 + aa2 / c;
      if (Math.abs(c) < fpmin) c = fpmin;
      d = 1 / d;
      h *= d * c;
      aa2 = (-(aa + m) * (qab + m) * xx) / ((aa + m2) * (qap + m2));
      d = 1 + aa2 * d;
      if (Math.abs(d) < fpmin) d = fpmin;
      c = 1 + aa2 / c;
      if (Math.abs(c) < fpmin) c = fpmin;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < eps) break;
    }
    return h;
  };
  if (x < (a + 1) / (a + b + 2)) {
    return (front * cf(a, b, x)) / a;
  }
  return 1 - (front * cf(b, a, 1 - x)) / b;
}

/** Inverse regularized incomplete beta via bisection. */
export function betaQuantile(p: number, a: number, b: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const cdf = regularizedIncompleteBeta(mid, a, b);
    if (cdf < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function betaCredibleInterval(
  wins: number,
  total: number,
  priorAlpha = 1,
  priorBeta = 1,
  level = 0.95
): [number, number] {
  const a = priorAlpha + wins;
  const b = priorBeta + Math.max(0, total - wins);
  const tail = (1 - level) / 2;
  return [betaQuantile(tail, a, b), betaQuantile(1 - tail, a, b)];
}

export function fitBinaryPositiveReturnPosterior(
  observations: AhBetObservation[],
  prior: [number, number] = [1, 1]
): AhBinaryPosterior {
  let wins = 0;
  let decisions = 0;
  for (const o of observations) {
    if (o.settlement === 'FULL_WIN' || o.settlement === 'HALF_WIN') wins += 1;
    if (o.settlement !== 'PUSH' && o.settlement !== 'VOID') decisions += 1;
  }
  const probability = (wins + prior[0]) / (decisions + prior[0] + prior[1]);
  return {
    wins,
    decisions,
    probability,
    ci95: betaCredibleInterval(wins, decisions, prior[0], prior[1], 0.95),
  };
}

export function fitAhPosterior(
  observations: AhBetObservation[],
  alphaPrior: number[] = [1, 1, 1, 1, 1]
): AhDirichletPosterior {
  if (alphaPrior.length !== SETTLEMENT_CATEGORIES.length) {
    throw new Error('fitAhPosterior: alphaPrior must have 5 entries');
  }
  const counts: Record<SettlementCategory, number> = {
    FULL_WIN: 0,
    HALF_WIN: 0,
    PUSH: 0,
    HALF_LOSS: 0,
    FULL_LOSS: 0,
  };
  let n = 0;
  for (const o of observations) {
    if (o.settlement === 'VOID') continue;
    counts[o.settlement as SettlementCategory] += 1;
    n += 1;
  }
  const alphaPosterior = SETTLEMENT_CATEGORIES.map((c, i) => alphaPrior[i] + counts[c]);
  const total = alphaPosterior.reduce((s, a) => s + a, 0);

  const p = (i: number) => alphaPosterior[i] / total;
  const credibleIntervals = {} as Record<SettlementCategory, [number, number]>;
  SETTLEMENT_CATEGORIES.forEach((c, i) => {
    const a = alphaPosterior[i];
    const b = total - a;
    credibleIntervals[c] = [
      Number(betaQuantile(0.025, a, b).toFixed(6)),
      Number(betaQuantile(0.975, a, b).toFixed(6)),
    ];
  });

  const pFW = p(0);
  const pHW = p(1);
  const pP = p(2);
  const pHL = p(3);
  const pFL = p(4);

  return {
    n,
    counts,
    alphaPrior,
    alphaPosterior,
    pFullWin: pFW,
    pHalfWin: pHW,
    pPush: pP,
    pHalfLoss: pHL,
    pFullLoss: pFL,
    pProfit: pFW + pHW,
    pCoverOrPush: pFW + pHW + pP,
    expectedSettleScore: pFW + 0.5 * pHW - 0.5 * pHL - pFL,
    credibleIntervals,
  };
}
