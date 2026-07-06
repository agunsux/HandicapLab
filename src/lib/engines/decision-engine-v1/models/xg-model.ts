// HandicapLab Decision Engine v1 - xG Based Poisson Model
// Location: src/lib/engines/decision-engine-v1/models/xg-model.ts

import { EnsembleSubModel, ModelPrediction } from '../registry';
import { MatchFeatures } from '../../feature-engine/types';
import { PoissonModel } from '../../probability-engine/poisson';

export class XGModel implements EnsembleSubModel {
  public id = 'xg';
  public name = 'Expected Goals (xG) Probability Model';

  public async predict(features: MatchFeatures): Promise<ModelPrediction> {
    const adjustedFeatures = { ...features };
    const homeXG = features.homeAttack * 1.05;
    const awayXG = features.awayAttack * 0.95;

    adjustedFeatures.homeAttack = homeXG;
    adjustedFeatures.awayAttack = awayXG;

    const raw = PoissonModel.predict(adjustedFeatures);
    
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

    const confidence = 92;

    return {
      homeProbability: Number(homeProbability.toFixed(4)),
      drawProbability: Number(drawProbability.toFixed(4)),
      awayProbability: Number(awayProbability.toFixed(4)),
      confidence,
      modelName: 'xG Model',
      version: '1.0.0'
    };
  }
}
