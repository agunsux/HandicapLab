// HandicapLab Decision Engine v1 - Elo Rating Model
// Location: src/lib/engines/decision-engine-v1/models/elo-rating.ts

import { EnsembleSubModel, ModelPrediction } from '../registry';
import { MatchFeatures } from '../../feature-engine/types';

export class EloRatingModel implements EnsembleSubModel {
  public id = 'elo';
  public name = 'Elo Rating Probability Model';

  public async predict(features: MatchFeatures): Promise<ModelPrediction> {
    const homeElo = features.homeElo ?? 1500;
    const awayElo = features.awayElo ?? 1500;
    
    const homeAdvantage = features.isHomeAdvantage !== false ? 90 : 0;
    const eloDifference = homeElo + homeAdvantage - awayElo;

    const expectedHomeScore = 1 / (1 + Math.pow(10, -eloDifference / 400));
    
    const drawProbability = 0.26;
    const homeProbability = expectedHomeScore * (1 - drawProbability);
    const awayProbability = Math.max(0, 1.0 - homeProbability - drawProbability);

    const confidence = Math.min(100, Math.max(30, (features.historicalMatchesCount ?? 0) * 5));

    return {
      homeProbability: Number(homeProbability.toFixed(4)),
      drawProbability: Number(drawProbability.toFixed(4)),
      awayProbability: Number(awayProbability.toFixed(4)),
      confidence,
      modelName: 'Elo Rating',
      version: '1.0.0'
    };
  }
}
