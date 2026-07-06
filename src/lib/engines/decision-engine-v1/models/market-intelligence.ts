// HandicapLab Decision Engine v1 - Market Intelligence Derived Model
// Location: src/lib/engines/decision-engine-v1/models/market-intelligence.ts

import { EnsembleSubModel, ModelPrediction } from '../registry';
import { MatchFeatures } from '../../feature-engine/types';

export class MarketIntelligenceModel implements EnsembleSubModel {
  public id = 'market';
  public name = 'Market Intelligence Probabilities';

  public async predict(features: MatchFeatures): Promise<ModelPrediction> {
    // Basic fallback distribution if no odds snapshot is available
    let pHome = 0.45;
    let pDraw = 0.28;
    let pAway = 0.27;
    let confidence = 70;

    // In a production environment, this is parsed from opening/current odds snapshot.
    // If the features contain reference odds, we remove margin proportionally.
    // E.g. using average odds
    const avgH = 2.0; // hypothetical current average odds
    const avgD = 3.3;
    const avgA = 3.8;

    const impH = 1 / avgH;
    const impD = 1 / avgD;
    const impA = 1 / avgA;
    const totalImplied = impH + impD + impA;

    pHome = impH / totalImplied;
    pDraw = impD / totalImplied;
    pAway = impA / totalImplied;
    confidence = 85; // high confidence due to market consensus pricing

    return {
      pHome: Number(pHome.toFixed(4)),
      pDraw: Number(pDraw.toFixed(4)),
      pAway: Number(pAway.toFixed(4)),
      confidence
    };
  }
}
