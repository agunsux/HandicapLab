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
    
    // EPL home field advantage is worth roughly +90 Elo points
    const homeAdvantage = features.isHomeAdvantage !== false ? 90 : 0;
    const eloDifference = homeElo + homeAdvantage - awayElo;

    // Standard Elo expectation formula: E = 1 / (1 + 10^(-diff / 400))
    const expectedHomeScore = 1 / (1 + Math.pow(10, -eloDifference / 400));
    
    // Draw probability in professional football averages ~26%
    const pDraw = 0.26;
    
    // Rest of probability distributed proportionally to home vs away strength
    const pHome = expectedHomeScore * (1 - pDraw);
    const pAway = Math.max(0, 1.0 - pHome - pDraw);

    // Confidence scales with sample size of historical matches
    const confidence = Math.min(100, Math.max(30, (features.historicalMatchesCount ?? 0) * 5));

    return {
      pHome: Number(pHome.toFixed(4)),
      pDraw: Number(pDraw.toFixed(4)),
      pAway: Number(pAway.toFixed(4)),
      confidence
    };
  }
}
