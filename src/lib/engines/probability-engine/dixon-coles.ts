import { MatchFeatures } from '../feature-engine/types';
import { RawProbabilities } from './types';
import { PoissonModel } from './poisson';

export class DixonColesModel {
  /**
   * Predict match outcomes using the Dixon-Coles model.
   * Modifies Poisson probabilities for low score lines (0-0, 1-0, 0-1, 1-1)
   * to account for low-scoring interdependence.
   * 
   * @param features MatchFeatures inputs
   * @param rho Dixon-Coles dependency parameter (default: -0.06)
   */
  public static predict(features: MatchFeatures, rho: number = -0.06): RawProbabilities {
    const base = PoissonModel.predict(features);
    const lambda = base.homeLambda;
    const mu = base.awayLambda;
    
    // Deep copy score matrix to avoid mutating base Poisson results
    const scoreMatrix = base.scoreMatrix.map(row => [...row]);

    // Dixon-Coles adjustment factor tau(x, y)
    const tau = (x: number, y: number): number => {
      if (x === 0 && y === 0) return 1 - lambda * mu * rho;
      if (x === 1 && y === 0) return 1 + mu * rho;
      if (x === 0 && y === 1) return 1 + lambda * rho;
      if (x === 1 && y === 1) return 1 - rho;
      return 1.0;
    };

    let sum = 0;
    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        if (h <= 1 && a <= 1) {
          scoreMatrix[h][a] = Math.max(0, scoreMatrix[h][a] * tau(h, a));
        }
        sum += scoreMatrix[h][a];
      }
    }

    // Normalize adjusted matrix so that probabilities sum to 1.0
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
