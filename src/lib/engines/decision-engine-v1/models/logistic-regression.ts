// HandicapLab Decision Engine v1 - Logistic Regression Model
// Location: src/lib/engines/decision-engine-v1/models/logistic-regression.ts

import { EnsembleSubModel, ModelPrediction } from '../registry';
import { MatchFeatures } from '../../feature-engine/types';

export class LogisticRegressionModel implements EnsembleSubModel {
  public id = 'logistic';
  public name = 'Logistic Regression Model';

  /**
   * Logistic function wrapper: 1 / (1 + e^-z)
   */
  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }

  public async predict(features: MatchFeatures): Promise<ModelPrediction> {
    const eloDelta = (features.homeElo ?? 1500) - (features.awayElo ?? 1500);
    const restDelta = (features.homeRestDays ?? 4) - (features.awayRestDays ?? 4);
    
    // Compute logit score for home win
    // Weights are calibrated benchmarks for professional match forecasting
    const homeLogit = 0.15 + (eloDelta * 0.0035) + (restDelta * 0.04);
    const pHomeRaw = this.sigmoid(homeLogit);

    // Compute logit score for away win
    const awayLogit = -0.15 - (eloDelta * 0.0035) - (restDelta * 0.04);
    const pAwayRaw = this.sigmoid(awayLogit);

    // Re-normalize with draw inclusion
    const drawLogit = -0.8; // Baseline intercept for draw
    const pDrawRaw = this.sigmoid(drawLogit);

    const sum = pHomeRaw + pAwayRaw + pDrawRaw;
    
    const pHome = pHomeRaw / sum;
    const pDraw = pDrawRaw / sum;
    const pAway = pAwayRaw / sum;

    // Confidence mapping based on squad continuity details
    const completeness = features.squadContinuityHome ?? 1.0;
    const confidence = Math.round(Math.min(100, Math.max(20, completeness * 90)));

    return {
      pHome: Number(pHome.toFixed(4)),
      pDraw: Number(pDraw.toFixed(4)),
      pAway: Number(pAway.toFixed(4)),
      confidence
    };
  }
}
