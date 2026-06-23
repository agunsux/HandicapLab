import { MatchFeatures } from '../feature-engine/types';
import { RawProbabilities } from './types';
import { PoissonModel } from './poisson';
import { DixonColesModel } from './dixon-coles';

export class EnsembleModel {
  /**
   * Predict match score probabilities using a weighted ensemble of Poisson and Dixon-Coles models.
   * 
   * @param features MatchFeatures inputs
   * @param weights Configuration weights (default: 0.5 each)
   */
  public static predict(
    features: MatchFeatures,
    weights: { poisson: number; dixonColes: number } = { poisson: 0.5, dixonColes: 0.5 }
  ): RawProbabilities {
    const pProbs = PoissonModel.predict(features);
    const dcProbs = DixonColesModel.predict(features);

    // Normalize weights
    const sumWeights = weights.poisson + weights.dixonColes;
    const wP = sumWeights > 0 ? weights.poisson / sumWeights : 0.5;
    const wDC = sumWeights > 0 ? weights.dixonColes / sumWeights : 0.5;

    const scoreMatrix: number[][] = [];
    let sum = 0;

    // Combine score matrices
    for (let h = 0; h <= 10; h++) {
      scoreMatrix[h] = [];
      for (let a = 0; a <= 10; a++) {
        const prob = wP * pProbs.scoreMatrix[h][a] + wDC * dcProbs.scoreMatrix[h][a];
        scoreMatrix[h][a] = prob;
        sum += prob;
      }
    }

    // Normalize the final matrix to ensure exactly 1.0 sum
    if (sum > 0) {
      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          scoreMatrix[h][a] = scoreMatrix[h][a] / sum;
        }
      }
    }

    const homeLambda = wP * pProbs.homeLambda + wDC * dcProbs.homeLambda;
    const awayLambda = wP * pProbs.awayLambda + wDC * dcProbs.awayLambda;

    return {
      homeLambda,
      awayLambda,
      scoreMatrix
    };
  }
}
