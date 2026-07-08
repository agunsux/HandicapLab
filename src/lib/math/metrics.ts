// Canonical Math & Statistics Utilities — Single Source of Truth
// Location: src/lib/math/metrics.ts
// Usage: import { logLoss, brierScore, calculateECE, sigmoid, factorial, normalCDF } from '@/lib/math/metrics';

/**
 * Clamp probability to avoid log(0) issues.
 */
export function clampProb(p: number): number {
  return Math.max(0.0001, Math.min(0.9999, p));
}

/**
 * Log Loss (Cross-Entropy) — single observation.
 */
export function logLoss(prob: number, actual: number): number {
  const p = clampProb(prob);
  return -(actual * Math.log(p) + (1 - actual) * Math.log(1 - p));
}

/**
 * Brier Score — single observation.
 */
export function brierScore(prob: number, actual: number): number {
  return (prob - actual) ** 2;
}

/**
 * Sigmoid function.
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Factorial (integer, iterative).
 */
export function factorial(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/**
 * Poisson probability: P(k; lambda) = (lambda^k * e^-lambda) / k!
 */
export function poissonProb(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/**
 * Expected Calibration Error (ECE).
 */
export function calculateECE(probs: number[], actuals: number[], numBins: number = 10): number {
  if (probs.length === 0) return 0;
  const bins = Array.from({ length: numBins }, () => ({ count: 0, pSum: 0, aSum: 0 }));
  for (let i = 0; i < probs.length; i++) {
    const idx = Math.min(numBins - 1, Math.floor(probs[i] * numBins));
    bins[idx].count++;
    bins[idx].pSum += probs[i];
    bins[idx].aSum += actuals[i];
  }
  let ece = 0;
  const n = probs.length;
  for (const b of bins) {
    if (b.count > 0) {
      ece += (b.count / n) * Math.abs((b.pSum / b.count) - (b.aSum / b.count));
    }
  }
  return ece;
}

/**
 * Normal CDF (Abramowitz & Stegun approximation).
 */
export function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

/**
 * Z-score to p-value (two-tailed).
 */
export function zToPValue(z: number): number {
  return 2 * (1 - normalCDF(Math.abs(z)));
}

/**
 * Binomial standard error.
 */
export function binomialSE(p: number, n: number): number {
  return Math.sqrt((p * (1 - p)) / Math.max(1, n));
}

/**
 * Kelly fraction: f* = (p * b - 1) / (b - 1)
 */
export function kellyFraction(prob: number, odds: number): number {
  if (odds <= 1) return 0;
  const ev = prob * odds - 1;
  if (ev <= 0) return 0;
  return ev / (odds - 1);
}

/**
 * Convert implied probability to decimal odds (vig-adjusted).
 */
export function probToOdds(prob: number): number {
  return prob > 0 ? 1 / prob : 0;
}

/**
 * Convert decimal odds to implied probability.
 */
export function oddsToProb(odds: number): number {
  return odds > 1 ? 1 / odds : 0;
}

/**
 * Remove vig from three-way market odds.
 * Returns normalized probabilities summing to 1.
 */
export function removeVig(oddsHome: number, oddsDraw: number, oddsAway: number): { homeProb: number; drawProb: number; awayProb: number } {
  const ih = oddsToProb(oddsHome);
  const id = oddsToProb(oddsDraw);
  const ia = oddsToProb(oddsAway);
  const total = ih + id + ia;
  return {
    homeProb: total > 0 ? ih / total : 0.45,
    drawProb: total > 0 ? id / total : 0.1,
    awayProb: total > 0 ? ia / total : 0.45,
  };
}
