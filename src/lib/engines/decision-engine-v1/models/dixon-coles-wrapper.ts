// HandicapLab Decision Engine v1 - Dixon Coles Model Wrapper
// Location: src/lib/engines/decision-engine-v1/models/dixon-coles-wrapper.ts

import { PredictionModel, ModelMetadata, Prediction } from './predictionModel';
import { MatchFeatures } from '../../feature-engine/types';
import { DixonColesModel } from '../../probability-engine/dixon-coles';

export class DixonColesModelWrapper implements PredictionModel {
  public metadata(): ModelMetadata {
    return {
      name: 'Dixon-Coles Model',
      version: '2.0.0',
      description: 'Dixon-Coles model accounting for low-scoring draws',
      isOnline: false
    };
  }

  public async train(trainData: any[]): Promise<void> {
    // Statistically based on DixonColesModel which might have static learning or just uses input features directly.
  }

  public async predict(features: MatchFeatures | any): Promise<Prediction> {
    const raw = DixonColesModel.predict(features, -0.06);
    
    let pHome = 0;
    let pDraw = 0;
    let pAway = 0;

    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        const p = raw.scoreMatrix[h][a];
        if (h > a) pHome += p;
        else if (h === a) pDraw += p;
        else pAway += p;
      }
    }

    const sum = pHome + pDraw + pAway;
    const homeProbability = pHome / sum;
    const drawProbability = pDraw / sum;
    const awayProbability = pAway / sum;

    return {
      pHome: Number(homeProbability.toFixed(4)),
      pDraw: Number(drawProbability.toFixed(4)),
      pAway: Number(awayProbability.toFixed(4)),
      expectedGoalsHome: raw.expectedGoalsHome,
      expectedGoalsAway: raw.expectedGoalsAway
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
