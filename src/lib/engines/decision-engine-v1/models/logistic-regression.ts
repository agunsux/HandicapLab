// HandicapLab Decision Engine v1 - Logistic Regression Model
// Location: src/lib/engines/decision-engine-v1/models/logistic-regression.ts

import { PredictionModel, ModelMetadata, Prediction } from './predictionModel';
import { MatchFeatures } from '../../feature-engine/types';

export class LogisticRegressionModel implements PredictionModel {
  public metadata(): ModelMetadata {
    return {
      name: 'Logistic Regression Model',
      version: '2.0.0',
      description: 'Multinomial logistic regression model using Elo and Rest Days',
      isOnline: false
    };
  }

  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }

  public async train(trainData: any[]): Promise<void> {
    // In a full implementation, we'd learn weights here.
    // For now, it uses hardcoded logistic weights.
  }

  public async predict(features: MatchFeatures | any): Promise<Prediction> {
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

    return {
      pHome: Number(homeProbability.toFixed(4)),
      pDraw: Number(drawProbability.toFixed(4)),
      pAway: Number(awayProbability.toFixed(4)),
      expectedGoalsHome: homeProbability * 3, // rough
      expectedGoalsAway: awayProbability * 3 // rough
    };
  }

  public async predictProbability(features: MatchFeatures | any): Promise<{ pHome: number; pDraw: number; pAway: number }> {
    const p = await this.predict(features);
    return { pHome: p.pHome, pDraw: p.pDraw, pAway: p.pAway };
  }

  public async predictScore(features: MatchFeatures | any): Promise<{ home: number; away: number }> {
    const p = await this.predict(features);
    return { home: p.expectedGoalsHome || 0, away: p.expectedGoalsAway || 0 };
  }
}
