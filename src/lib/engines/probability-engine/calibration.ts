import { RawProbabilities } from './types';

export class Calibrator {
  /**
   * Calibrates a single probability using Platt Scaling.
   * Formula: p* = 1 / (1 + exp(-(A * logit(p) + B)))
   */
  public static calibrateProbability(p: number, A: number = 1.02, B: number = -0.01): number {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    // Logit of p
    const clampedP = Math.max(0.0001, Math.min(0.9999, p));
    const logit = Math.log(clampedP / (1 - clampedP));
    // Platt scaling sigmoid
    const calibrated = 1 / (1 + Math.exp(-(A * logit + B)));
    return Math.max(0.0001, Math.min(0.9999, calibrated));
  }

  /**
   * Calibrates a single probability using a pre-calculated isotonic regression binning system.
   * Ensures output is monotonically increasing.
   */
  public static calibrateIsotonic(p: number): number {
    // Pre-fit isotonic regression bins
    const bins = [
      { threshold: 0.1, val: 0.08 },
      { threshold: 0.2, val: 0.18 },
      { threshold: 0.3, val: 0.28 },
      { threshold: 0.4, val: 0.39 },
      { threshold: 0.5, val: 0.49 },
      { threshold: 0.6, val: 0.59 },
      { threshold: 0.7, val: 0.71 },
      { threshold: 0.8, val: 0.81 },
      { threshold: 0.9, val: 0.91 },
      { threshold: 1.0, val: 0.98 }
    ];

    for (const bin of bins) {
      if (p <= bin.threshold) {
        return bin.val;
      }
    }
    return 0.99;
  }

  /**
   * Calibrates raw probabilities (score matrix) using Platt scaling or isotonic regression.
   * Then re-normalizes the matrix to ensure sum is exactly 1.0.
   */
  public static calibrate(
    rawProbs: RawProbabilities,
    method: 'platt' | 'isotonic' = 'platt',
    A: number = 1.02,
    B: number = -0.01
  ): RawProbabilities {
    const scoreMatrix = rawProbs.scoreMatrix.map(row =>
      row.map(p => {
        if (method === 'platt') {
          return this.calibrateProbability(p, A, B);
        } else {
          return this.calibrateIsotonic(p);
        }
      })
    );

    // Re-normalize score matrix
    let sum = 0;
    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        sum += scoreMatrix[h][a];
      }
    }

    if (sum > 0) {
      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          scoreMatrix[h][a] = scoreMatrix[h][a] / sum;
        }
      }
    }

    return {
      homeLambda: rawProbs.homeLambda,
      awayLambda: rawProbs.awayLambda,
      scoreMatrix
    };
  }
}
