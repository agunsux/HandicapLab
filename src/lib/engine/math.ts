/**
 * Pure mathematical core functions for HandicapLab Quant Engine.
 * All functions are deterministic, pure, and safe from numerical overflow.
 */

/**
 * Calculates the natural logarithm of the factorial of n.
 * Uses an iterative approach which is fast and safe for standard football score values (k < 100).
 */
export function logFactorial(n: number): number {
  if (n < 0) return -Infinity;
  let sum = 0;
  for (let i = 2; i <= n; i++) {
    sum += Math.log(i);
  }
  return sum;
}

/**
 * Calculates Poisson Probability Mass Function: P(X = k)
 * Numerically safe implementation utilizing log-space calculations to avoid float overflow.
 */
export function poissonPMF(lambda: number, k: number): number {
  // Guard against invalid inputs
  if (lambda <= 0 || k < 0 || !Number.isInteger(k)) {
    return 0;
  }
  
  // P(k; lambda) = exp( k * ln(lambda) - lambda - ln(k!) )
  const logP = k * Math.log(lambda) - lambda - logFactorial(k);
  return Math.exp(logP);
}

/**
 * Calculates Poisson Cumulative Distribution Function: P(X <= k)
 */
export function poissonCDF(lambda: number, k: number): number {
  if (lambda <= 0 || k < 0) {
    return 0;
  }
  
  const limit = Math.floor(k);
  let sum = 0;
  for (let i = 0; i <= limit; i++) {
    sum += poissonPMF(lambda, i);
  }
  return Math.min(1.0, sum);
}

/**
 * Dixon-Coles dependency correction factor for low-scoring matches.
 * Standard Poisson assumes goal events are independent, which underestimates draw probabilities
 * for low scorelines. Dixon-Coles corrects for this dependency with parameter rho.
 * 
 * PDC(x, y) = P(Poisson_home = x) * P(Poisson_away = y) * correction(x, y)
 * 
 * This function returns the correction factor tau(x, y).
 */
export function dixonColesCorrection(
  x: number,
  y: number,
  lambda: number,
  mu: number,
  rho: number
): number {
  // Only apply correction for non-negative integers x and y
  if (x < 0 || y < 0 || !Number.isInteger(x) || !Number.isInteger(y)) {
    return 1.0;
  }

  if (x === 0 && y === 0) {
    return 1.0 - rho * lambda * mu;
  }
  if (x === 1 && y === 0) {
    return 1.0 + rho * mu;
  }
  if (x === 0 && y === 1) {
    return 1.0 + rho * lambda;
  }
  if (x === 1 && y === 1) {
    return 1.0 - rho;
  }
  
  return 1.0;
}

/**
 * Calculates the fractional Kelly Criterion staking fraction.
 * 
 * Formula:
 * f* = probability - (1 - probability) / (odds - 1)
 * Kelly Stake = f* * fraction
 */
export function kellyFraction(
  probability: number,
  odds: number,
  fraction: number
): number {
  // Validate inputs
  if (probability <= 0 || probability > 1 || odds <= 1 || fraction <= 0) {
    return 0;
  }

  const edge = (probability * odds) - 1;
  // If there is no edge, return 0 (never negative)
  if (edge <= 0) {
    return 0;
  }

  const rawKelly = probability - (1.0 - probability) / (odds - 1.0);
  const result = rawKelly * fraction;
  
  return Math.max(0, result);
}

/**
 * Calculates the Brier Score to measure the calibration of probability forecasts.
 * 
 * Formula:
 * BS = (1 / N) * sum((probabilities[i] - outcomes[i])^2)
 * 
 * outcomes[i] is 1 if event occurred, 0 if not.
 */
export function brierScore(
  outcomes: number[],
  probabilities: number[]
): number {
  if (outcomes.length !== probabilities.length) {
    throw new Error('Outcomes and probabilities arrays must have the same length.');
  }
  if (outcomes.length === 0) {
    throw new Error('Array lengths cannot be zero.');
  }

  let sumSquaredDiffs = 0;
  for (let i = 0; i < outcomes.length; i++) {
    const p = probabilities[i];
    const o = outcomes[i];
    if (p < 0 || p > 1) {
      throw new Error(`Invalid probability at index ${i}: ${p}`);
    }
    if (o !== 0 && o !== 1) {
      throw new Error(`Invalid outcome at index ${i}: ${o} (must be 0 or 1)`);
    }
    sumSquaredDiffs += Math.pow(p - o, 2);
  }

  return sumSquaredDiffs / outcomes.length;
}
