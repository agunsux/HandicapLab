/**
 * REAL MARKET YIELD AUDIT — STATISTICAL ENGINE & FDR PROCEDURE
 * Location: src/lib/research/real-yield/statistics.ts
 *
 * Implements deterministic seeded bootstrap CI, raw p-value estimation,
 * and the complete Benjamini-Hochberg FDR multiple-testing correction.
 */

export interface HypothesisEvaluationStats {
  hypothesisId: string;
  market: 'AH' | 'OU_2_5' | '1X2';
  targetKey: string;
  oddsBand: string;
  eligibleObservations: number;
  betsCount: number;
  winsCount: number;
  lossesCount: number;
  pushesCount: number;
  halfWinsCount: number;
  halfLossesCount: number;
  totalStake: number;
  totalProfit: number;
  realizedRoi: number; // profit / totalStake
  meanReturn: number; // mean profit per bet
  meanOdds: number;
  meanModelProbability: number;
  meanEv: number;
  bootstrapCi95: [number, number]; // [lower, upper]
  probabilityPositiveRoi: number;
  rawPValue: number;
  fdrAdjustedQValue: number;
  fdrPass: boolean; // q <= 0.10
  isCandidate: boolean;
}

/** Deterministic PRNG (mulberry32) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard Normal CDF approximation (Abramowitz & Stegun formula 7.1.26) */
export function standardNormalCdf(x: number): number {
  if (x < -7.0) return 0.0;
  if (x > 7.0) return 1.0;

  const b1 = 0.31938153;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228; // 1 / sqrt(2*pi)

  const z = Math.abs(x);
  const t = 1.0 / (1.0 + p * z);
  const pdf = c * Math.exp(-0.5 * z * z);
  const poly = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;
  const ans = 1.0 - pdf * poly;

  return x >= 0 ? ans : 1.0 - ans;
}

/**
 * Computes raw p-value for H0: mean_return <= 0 vs H1: mean_return > 0
 */
export function computeRawPValue(pnlList: number[]): number {
  const n = pnlList.length;
  if (n < 2) return 1.0;

  let sum = 0;
  for (let i = 0; i < n; i++) sum += pnlList[i];
  const mean = sum / n;

  if (mean <= 0) {
    // If realized mean return is non-positive, p-value >= 0.5
    let sumSq = 0;
    for (let i = 0; i < n; i++) sumSq += (pnlList[i] - mean) ** 2;
    const variance = sumSq / (n - 1);
    const se = Math.sqrt(variance / n);
    if (se === 0) return 1.0;
    const t = mean / se;
    return Math.min(1.0, Math.max(0.5, 1.0 - standardNormalCdf(t)));
  }

  let sumSq = 0;
  for (let i = 0; i < n; i++) sumSq += (pnlList[i] - mean) ** 2;
  const variance = sumSq / (n - 1);
  const se = Math.sqrt(variance / n);

  if (se === 0) return mean > 0 ? 0.0 : 1.0;

  const t = mean / se;
  // One-sided p-value: P(T >= t | H0)
  const pVal = 1.0 - standardNormalCdf(t);
  return Math.max(0.000001, Math.min(1.0, pVal));
}

/**
 * Computes 95% Bootstrap CI and empirical probability ROI > 0
 */
export function computeBootstrapCi(
  pnlList: number[],
  stakeList: number[],
  iterations = 1000,
  seed = 0x5eed
): { ci95: [number, number]; probabilityPositive: number } {
  const n = pnlList.length;
  if (n === 0) return { ci95: [0, 0], probabilityPositive: 0 };

  const rand = mulberry32(seed);
  const rois: number[] = new Array(iterations);

  for (let b = 0; b < iterations; b++) {
    let samplePnl = 0;
    let sampleStake = 0;
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rand() * n);
      samplePnl += pnlList[idx];
      sampleStake += stakeList[idx];
    }
    rois[b] = sampleStake > 0 ? samplePnl / sampleStake : 0;
  }

  rois.sort((a, b) => a - b);

  const lowerIdx = Math.floor(iterations * 0.025);
  const upperIdx = Math.floor(iterations * 0.975);
  const ciLower = Number(rois[lowerIdx].toFixed(4));
  const ciUpper = Number(rois[upperIdx].toFixed(4));

  const positiveCount = rois.filter((r) => r > 0).length;
  const probabilityPositive = Number((positiveCount / iterations).toFixed(4));

  return {
    ci95: [ciLower, ciUpper],
    probabilityPositive,
  };
}

/**
 * Applies Benjamini-Hochberg FDR procedure across the complete hypothesis family.
 *
 * Algorithm:
 * 1. Sort p-values in ascending order: p_(1) <= p_(2) <= ... <= p_(M)
 * 2. q_(i) = min_{j >= i} ( min(1, (M / j) * p_(j)) )
 * 3. Hypothesis is significant at FDR q if adjusted q-value <= q_threshold.
 */
export function applyBenjaminiHochberg<T extends { rawPValue: number }>(
  items: T[],
  fdrQ = 0.10
): (T & { fdrAdjustedQValue: number; fdrPass: boolean })[] {
  const m = items.length;
  if (m === 0) return [];

  // Indexed copy for sorting
  const indexed = items.map((item, originalIndex) => ({
    item,
    originalIndex,
    p: item.rawPValue,
  }));

  // Sort ascending by p-value
  indexed.sort((a, b) => a.p - b.p);

  // Compute raw Benjamini-Hochberg q-values: (m / rank) * p
  const rawQ: number[] = new Array(m);
  for (let i = 0; i < m; i++) {
    const rank = i + 1;
    rawQ[i] = Math.min(1.0, (m / rank) * indexed[i].p);
  }

  // Enforce monotonicity backwards: q_(i) = min_{j >= i} rawQ[j]
  const adjustedQ: number[] = new Array(m);
  let minNext = 1.0;
  for (let i = m - 1; i >= 0; i--) {
    minNext = Math.min(minNext, rawQ[i]);
    adjustedQ[i] = Number(minNext.toFixed(6));
  }

  // Map back to original order
  const result: (T & { fdrAdjustedQValue: number; fdrPass: boolean })[] = new Array(m);
  for (let i = 0; i < m; i++) {
    const origIdx = indexed[i].originalIndex;
    const qVal = adjustedQ[i];
    result[origIdx] = {
      ...indexed[i].item,
      fdrAdjustedQValue: qVal,
      fdrPass: qVal <= fdrQ,
    };
  }

  return result;
}

