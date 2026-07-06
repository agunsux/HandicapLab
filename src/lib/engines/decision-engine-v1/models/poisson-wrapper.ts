// HandicapLab Decision Engine v1 - Poisson Model Wrapper
// Location: src/lib/engines/decision-engine-v1/models/poisson-wrapper.ts

import { EnsembleSubModel, ModelPrediction } from '../registry';
import { MatchFeatures } from '../../feature-engine/types';
import { PoissonModel } from '../../probability-engine/poisson';

export class PoissonModelWrapper implements EnsembleSubModel {
  public id = 'poisson';
  public name = 'Poisson Probability Model';

  public async predict(features: MatchFeatures): Promise<ModelPrediction> {
    const raw = PoissonModel.predict(features);
    
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

    const confidence = features.leagueId === '39' ? 85 : 75;

    return {
      homeProbability: Number(homeProbability.toFixed(4)),
      drawProbability: Number(drawProbability.toFixed(4)),
      awayProbability: Number(awayProbability.toFixed(4)),
      confidence,
      modelName: 'Poisson',
      version: '1.0.0'
    };
  }
}
