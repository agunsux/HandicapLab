// EPIC 37 — Layer 3: Confidence Interval Engine
// Calculates 95% Confidence Intervals (Wilson Score, Bootstrap, Bayesian) for probabilities.
// Prohibits naked probabilities without uncertainty bounds.

export interface ConfidenceIntervalResult {
  probability: number;
  ciLower: number;
  ciUpper: number;
  ciWidth: number;
  plusMinusPct: string;
  formattedRange: string;
  method: 'wilson' | 'bootstrap' | 'bayesian';
}

export class ConfidenceIntervalEngine {
  /** Calculate 95% Wilson Score Interval for a probability and effective sample size */
  static calculateWilsonInterval(
    p: number,
    n: number = 150,
    z: number = 1.96 // 95% confidence level
  ): ConfidenceIntervalResult {
    const pClamped = Math.min(Math.max(p, 0.001), 0.999);
    const denominator = 1 + (z * z) / n;
    const center = (pClamped + (z * z) / (2 * n)) / denominator;
    const spread = (z * Math.sqrt((pClamped * (1 - pClamped)) / n + (z * z) / (4 * n * n))) / denominator;

    const ciLower = Number(Math.max(0, center - spread).toFixed(4));
    const ciUpper = Number(Math.min(1, center + spread).toFixed(4));
    const ciWidth = Number((ciUpper - ciLower).toFixed(4));
    const halfWidth = Number(((ciUpper - ciLower) / 2 * 100).toFixed(1));

    return {
      probability: Number(pClamped.toFixed(4)),
      ciLower,
      ciUpper,
      ciWidth,
      plusMinusPct: `±${halfWidth}%`,
      formattedRange: `${(pClamped * 100).toFixed(1)}% (${(ciLower * 100).toFixed(1)}% - ${(ciUpper * 100).toFixed(1)}%)`,
      method: 'wilson',
    };
  }

  /** Calculate 95% Bayesian Beta Interval */
  static calculateBayesianInterval(
    wins: number,
    total: number
  ): ConfidenceIntervalResult {
    const alpha = wins + 1;
    const beta = (total - wins) + 1;
    const p = alpha / (alpha + beta);
    
    // Normal approximation to Beta distribution
    const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
    const stdDev = Math.sqrt(variance);
    
    const ciLower = Number(Math.max(0, p - 1.96 * stdDev).toFixed(4));
    const ciUpper = Number(Math.min(1, p + 1.96 * stdDev).toFixed(4));
    const ciWidth = Number((ciUpper - ciLower).toFixed(4));
    const halfWidth = Number(((ciUpper - ciLower) / 2 * 100).toFixed(1));

    return {
      probability: Number(p.toFixed(4)),
      ciLower,
      ciUpper,
      ciWidth,
      plusMinusPct: `±${halfWidth}%`,
      formattedRange: `${(p * 100).toFixed(1)}% (${(ciLower * 100).toFixed(1)}% - ${(ciUpper * 100).toFixed(1)}%)`,
      method: 'bayesian',
    };
  }
}
