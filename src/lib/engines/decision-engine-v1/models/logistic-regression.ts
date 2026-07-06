// HandicapLab Decision Engine v1 - Logistic Regression Model
// Location: src/lib/engines/decision-engine-v1/models/logistic-regression.ts

import { EnsembleSubModel, ModelPrediction } from '../registry';
import { MatchFeatures } from '../../feature-engine/types';

export class LogisticRegressionModel implements EnsembleSubModel {
  public id = 'logistic';
  public name = 'Logistic Regression Model';

  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }

  public async predict(features: MatchFeatures): Promise<ModelPrediction> {
    const eloDelta = (features.homeElo ?? 1500) - (features.awayElo ?? 1500);
    const restDelta = (features.homeRestDays ?? 4) - (features.awayRestDays ?? 4);
    
    const homeLogit = 0.15 + (eloDelta * 0.0035) + (restDelta * 0.04);
    const pHomeRaw = this.sigmoid(homeLogit);

    const awayLogit = -0.15 - (eloDelta * 0.0035) - (restDelta * 0.04);
    const pAwayRaw = this.sigmoid(awayLogit);

    const drawLogit = -0.8;
    const pDrawRaw = this.sigmoid(drawLogit);

    const sum = pHomeRaw + pAwayRaw + pDrawRaw;
    
    const homeProbability = pHomeRaw / sum;
    const drawProbability = pDrawRaw / sum;
    const awayProbability = pAwayRaw / sum;

    const completeness = features.squadContinuityHome ?? 1.0;
    const confidence = Math.round(Math.min(100, Math.max(20, completeness * 90)));

    return {
      homeProbability: Number(homeProbability.toFixed(4)),
      drawProbability: Number(drawProbability.toFixed(4)),
      awayProbability: Number(awayProbability.toFixed(4)),
      confidence,
      modelName: 'Logistic Regression',
      version: '1.0.0'
    };
  }
}
