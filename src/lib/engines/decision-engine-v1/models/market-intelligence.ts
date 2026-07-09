// HandicapLab Decision Engine v1 - Market Derived Model
// Location: src/lib/engines/decision-engine-v1/models/market-intelligence.ts

import { PredictionModel, ModelMetadata, Prediction } from './predictionModel';
import { MatchFeatures } from '../../feature-engine/types';

export class MarketIntelligenceModel implements PredictionModel {
  public metadata(): ModelMetadata {
    return {
      name: 'Market Intelligence CLV Model',
      version: '2.0.0',
      description: 'Heuristic model adjusting probabilities based on market movement and momentum',
      isOnline: false
    };
  }

  public async train(trainData: any[]): Promise<void> {}

  public async predict(features: MatchFeatures | any): Promise<Prediction> {
    const rawHome = features.closingOddsHome ? (1 / features.closingOddsHome) : 0.4;
    const rawDraw = features.closingOddsDraw ? (1 / features.closingOddsDraw) : 0.25;
    const rawAway = features.closingOddsAway ? (1 / features.closingOddsAway) : 0.35;

    const margin = rawHome + rawDraw + rawAway - 1.0;
    const marginPerSelection = margin / 3;

    let pHome = Math.max(0.01, rawHome - marginPerSelection);
    const pDraw = Math.max(0.01, rawDraw - marginPerSelection);
    const pAway = Math.max(0.01, rawAway - marginPerSelection);

    if (features.marketMomentumHome && features.marketMomentumHome > 1.0) {
      pHome *= 1.02;
    } else if (features.marketMomentumHome && features.marketMomentumHome < 1.0) {
      pHome *= 0.98;
    }

    const sum = pHome + pDraw + pAway;
    const homeProbability = pHome / sum;
    const drawProbability = pDraw / sum;
    const awayProbability = pAway / sum;

    return {
      pHome: Number(homeProbability.toFixed(4)),
      pDraw: Number(drawProbability.toFixed(4)),
      pAway: Number(awayProbability.toFixed(4))
    };
  }

  public async predictProbability(features: MatchFeatures | any): Promise<{ pHome: number; pDraw: number; pAway: number }> {
    const p = await this.predict(features);
    return { pHome: p.pHome, pDraw: p.pDraw, pAway: p.pAway };
  }

  public async predictScore(features: MatchFeatures | any): Promise<{ home: number; away: number }> {
    return { home: 0, away: 0 }; // Cannot predict score from odds easily without Poisson
  }
}
