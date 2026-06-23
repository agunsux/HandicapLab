import { MatchFeatures } from '../feature-engine/types';
import { RawProbabilities } from './types';

export class PoissonModel {
  /**
   * Calculates factorial of a number (up to 10).
   */
  private static factorial(n: number): number {
    if (n <= 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) {
      res *= i;
    }
    return res;
  }

  /**
   * Calculates Poisson Probability Density Function: P(X = k) = (lambda^k * e^-lambda) / k!
   */
  public static poissonPdf(k: number, lambda: number): number {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / this.factorial(k);
  }

  /**
   * Base Poisson model prediction.
   * Input: MatchFeatures
   * Output: Score matrix probabilities (11x11, 0 to 10 goals)
   */
  public static predict(features: MatchFeatures): RawProbabilities {
    const { homeAttack, awayDefense, awayAttack, homeDefense, leagueAvgGoals, isHomeAdvantage } = features;

    // Estimate base home/away league averages from overall leagueAvgGoals
    // Home team typically scores ~55% of goals at home when there is home advantage
    const homeBase = isHomeAdvantage ? leagueAvgGoals * 0.55 : leagueAvgGoals * 0.5;
    const awayBase = isHomeAdvantage ? leagueAvgGoals * 0.45 : leagueAvgGoals * 0.5;

    // Calculate lambda (expected home goals) and mu (expected away goals)
    // Clamp to minimum of 0.05 to avoid zero-mean calculation issues
    const lambda = Math.max(0.05, homeAttack * awayDefense * homeBase);
    const mu = Math.max(0.05, awayAttack * homeDefense * awayBase);

    const scoreMatrix: number[][] = [];
    let sum = 0;

    // Generate 11x11 matrix (scores 0-0 to 10-10)
    for (let h = 0; h <= 10; h++) {
      scoreMatrix[h] = [];
      const pH = this.poissonPdf(h, lambda);
      for (let a = 0; a <= 10; a++) {
        const pA = this.poissonPdf(a, mu);
        const prob = pH * pA;
        scoreMatrix[h][a] = prob;
        sum += prob;
      }
    }

    // Normalize matrix so all cell probabilities sum to exactly 1.0
    if (sum > 0) {
      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          scoreMatrix[h][a] = scoreMatrix[h][a] / sum;
        }
      }
    }

    return {
      homeLambda: lambda,
      awayLambda: mu,
      scoreMatrix
    };
  }
}
