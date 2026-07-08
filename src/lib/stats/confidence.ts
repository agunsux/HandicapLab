// Statistical Confidence — Bootstrap, Wilson Interval, Binomial Test
// Location: src/lib/stats/confidence.ts

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  pointEstimate: number;
  confidenceLevel: number;
}

export interface BootstrapResult {
  mean: number;
  median: number;
  stdError: number;
  ci95: ConfidenceInterval;
  ci99: ConfidenceInterval;
  distribution: number[];
}

export interface BinomialTestResult {
  pValue: number;
  observedRate: number;
  expectedRate: number;
  significant: boolean;
  effectSize: number;
}

export interface MultipleComparisonResult {
  adjustedPValues: number[];
  method: 'bonferroni' | 'holm' | 'bh' | 'by';
  significant: boolean[];
  alpha: number;
}

/**
 * Bootstrap confidence interval for any metric.
 */
export function bootstrapCI(
  values: number[],
  nResamples: number = 10000,
  confidenceLevel: number = 0.95
): BootstrapResult {
  if (values.length === 0) {
    return { mean: 0, median: 0, stdError: 0, ci95: { lower: 0, upper: 0, pointEstimate: 0, confidenceLevel }, ci99: { lower: 0, upper: 0, pointEstimate: 0, confidenceLevel }, distribution: [] };
  }
  const n = values.length;
  const means: number[] = [];

  for (let b = 0; b < nResamples; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += values[Math.floor(Math.random() * n)];
    }
    means.push(sum / n);
  }

  means.sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdError = Math.sqrt(variance / n);

  const alpha = 1 - confidenceLevel;
  const lowerIdx = Math.floor(nResamples * alpha / 2);
  const upperIdx = Math.floor(nResamples * (1 - alpha / 2));
  const lower99Idx = Math.floor(nResamples * 0.005);
  const upper99Idx = Math.floor(nResamples * 0.995);

  return {
    mean, median, stdError,
    ci95: { lower: means[lowerIdx] || 0, upper: means[upperIdx] || 0, pointEstimate: mean, confidenceLevel: 0.95 },
    ci99: { lower: means[lower99Idx] || 0, upper: means[upper99Idx] || 0, pointEstimate: mean, confidenceLevel: 0.99 },
    distribution: means,
  };
}

/**
 * Wilson Score interval for binomial proportions.
 */
export function wilsonInterval(successes: number, trials: number, confidenceLevel: number = 0.95): ConfidenceInterval {
  if (trials === 0) return { lower: 0, upper: 0, pointEstimate: 0, confidenceLevel };
  const z = confidenceLevel === 0.99 ? 2.576 : 1.96;
  const p = successes / trials;
  const denominator = 1 + z * z / trials;
  const center = (p + z * z / (2 * trials)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) / trials) + (z * z / (4 * trials * trials))) / denominator;
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    pointEstimate: p,
    confidenceLevel,
  };
}

/**
 * Binomial test against expected rate.
 */
export function binomialTest(successes: number, trials: number, expectedRate: number): BinomialTestResult {
  if (trials === 0) return { pValue: 1, observedRate: 0, expectedRate, significant: false, effectSize: 0 };
  const observedRate = successes / trials;
  const p0 = Math.max(0.001, Math.min(0.999, expectedRate));
  const se = Math.sqrt(p0 * (1 - p0) / trials);
  const z = (observedRate - p0) / (se || 0.001);
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  return {
    pValue: Math.min(1, pValue),
    observedRate,
    expectedRate,
    significant: pValue < 0.05,
    effectSize: observedRate - expectedRate,
  };
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * Permutation test for two groups.
 */
export function permutationTest(
  groupA: number[], groupB: number[], nPermutations: number = 10000
): { pValue: number; observedDiff: number; significant: boolean } {
  const all = [...groupA, ...groupB];
  const observedDiff = groupA.reduce((s, v) => s + v, 0) / groupA.length -
    groupB.reduce((s, v) => s + v, 0) / groupB.length;
  let extreme = 0;
  for (let p = 0; p < nPermutations; p++) {
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const permA = all.slice(0, groupA.length);
    const permB = all.slice(groupA.length);
    const diff = permA.reduce((s, v) => s + v, 0) / permA.length -
      permB.reduce((s, v) => s + v, 0) / permB.length;
    if (Math.abs(diff) >= Math.abs(observedDiff)) extreme++;
  }
  return { pValue: extreme / nPermutations, observedDiff, significant: extreme / nPermutations < 0.05 };
}

/**
 * Multiple comparison corrections (Bonferroni, Holm, Benjamini-Hochberg, Benjamini-Yekutieli).
 */
export function adjustPValues(pValues: number[], method: 'bonferroni' | 'holm' | 'bh' | 'by' = 'holm'): MultipleComparisonResult {
  const m = pValues.length;
  const sorted = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  let adjusted: number[];

  switch (method) {
    case 'bonferroni':
      adjusted = pValues.map(p => Math.min(1, p * m));
      break;
    case 'holm':
      adjusted = new Array(m).fill(0);
      for (let j = 0; j < m; j++) adjusted[sorted[j].i] = Math.min(1, sorted[j].p * (m - j));
      for (let j = m - 2; j >= 0; j--) adjusted[sorted[j].i] = Math.max(adjusted[sorted[j].i], adjusted[sorted[j + 1].i]);
      break;
    case 'bh':
      adjusted = new Array(m).fill(0);
      for (let j = m - 1; j >= 0; j--) {
        const q = sorted[j].p * m / (j + 1);
        adjusted[sorted[j].i] = Math.min(1, j < m - 1 ? Math.min(q, adjusted[sorted[j + 1].i]) : q);
      }
      break;
    case 'by':
      let c = 0; for (let k = 1; k <= m; k++) c += 1 / k;
      adjusted = new Array(m).fill(0);
      for (let j = m - 1; j >= 0; j--) {
        const q = sorted[j].p * m * c / (j + 1);
        adjusted[sorted[j].i] = Math.min(1, j < m - 1 ? Math.min(q, adjusted[sorted[j + 1].i]) : q);
      }
      break;
  }
  return { adjustedPValues: adjusted, method, significant: adjusted.map(p => p < 0.05), alpha: 0.05 };
}

/**
 * ROI confidence interval via bootstrap.
 */
export function roiConfidenceInterval(returns: number[]): { ci95: ConfidenceInterval; bootstrap: BootstrapResult } {
  return { ci95: bootstrapCI(returns).ci95, bootstrap: bootstrapCI(returns) };
}

/**
 * Yield confidence interval via bootstrap.
 */
export function yieldConfidenceInterval(profits: number[], stakes: number[]): ConfidenceInterval {
  const yields = profits.map((p, i) => stakes[i] > 0 ? p / stakes[i] : 0);
  return bootstrapCI(yields).ci95;
}

/**
 * Calibration error confidence interval via bootstrap.
 */
export function calibrationConfidenceInterval(calibrationErrors: number[]): ConfidenceInterval {
  return bootstrapCI(calibrationErrors).ci95;
}
