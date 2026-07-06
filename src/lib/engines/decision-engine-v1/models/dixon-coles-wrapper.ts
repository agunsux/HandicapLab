// HandicapLab Decision Engine v1 - Dixon Coles Model Wrapper
// Location: src/lib/engines/decision-engine-v1/models/dixon-coles-wrapper.ts

import { EnsembleSubModel, ModelPrediction } from '../registry';
import { MatchFeatures } from '../../feature-engine/types';
import { DixonColesModel } from '../../probability-engine/dixon-coles';

export class DixonColesModelWrapper implements EnsembleSubModel {
  public id = 'dixonColes';
  public name = 'Dixon-Coles Model';

  public async predict(features: MatchFeatures): Promise<ModelPrediction> {
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

    const confidence = features.leagueId === '39' ? 88 : 78;

    return {
      homeProbability: Number(homeProbability.toFixed(4)),
      drawProbability: Number(drawProbability.toFixed(4)),
      awayProbability: Number(awayProbability.toFixed(4)),
      confidence,
      modelName: 'Dixon-Coles',
      version: '1.0.0'
    };
  }
}
