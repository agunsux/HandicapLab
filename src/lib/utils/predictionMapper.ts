import { DbPrediction } from '../data/match';

export interface MappedPrediction {
  hasPrediction: boolean;
  moneyline: {
    homeProb: number;
    drawProb: number;
    awayProb: number;
  };
  asianHandicap: {
    recommendedLine: number;
    probability: number;
    edge: number;
  };
  overUnder: {
    line: number;
    overProb: number;
    underProb: number;
  };
  expectedGoals: {
    homeXg: number | null;
    awayXg: number | null;
    totalXg: number | null;
  };
  market: {
    openingOdds: number | null;
    currentOdds: any | null;
    closingOdds: any | null;
  };
  model: {
    confidence: string | null;
    predictionTime: string | null;
    modelVersion: string | null;
  };
}

export function mapPredictions(preds: DbPrediction[]): MappedPrediction {
  const result: MappedPrediction = {
    hasPrediction: preds.length > 0,
    moneyline: { homeProb: 0, drawProb: 0, awayProb: 0 },
    asianHandicap: { recommendedLine: 0, probability: 0, edge: 0 },
    overUnder: { line: 2.5, overProb: 0, underProb: 0 },
    expectedGoals: { homeXg: null, awayXg: null, totalXg: null },
    market: { openingOdds: null, currentOdds: null, closingOdds: null },
    model: { confidence: null, predictionTime: null, modelVersion: null }
  };

  if (preds.length === 0) {
    return result;
  }

  // Use the first prediction row for general metadata
  const firstPred = preds[0];
  result.model.confidence = firstPred.confidence || 'Low';
  result.model.predictionTime = firstPred.prediction_timestamp || firstPred.generated_at;
  result.model.modelVersion = firstPred.model_version || 'prematch-v1';

  // Read market values if available
  result.market.openingOdds = firstPred.entry_odds || null;
  result.market.currentOdds = firstPred.odds_snapshot || null;
  
  // Extract closing odds if stored inside snapshot or closing_odds field
  if (firstPred.odds_snapshot && typeof firstPred.odds_snapshot === 'object') {
    result.market.closingOdds = (firstPred.odds_snapshot as any).closing || null;
  }

  for (const p of preds) {
    const predObj = p.prediction || {};
    const edge = typeof p.edge_pct === 'number' ? p.edge_pct * 100 : 0;

    // Capture expected goals if present
    if (typeof predObj.expected_goals === 'number') {
      result.expectedGoals.totalXg = predObj.expected_goals;
    }
    if (typeof predObj.home_xg === 'number') {
      result.expectedGoals.homeXg = predObj.home_xg;
    }
    if (typeof predObj.away_xg === 'number') {
      result.expectedGoals.awayXg = predObj.away_xg;
    }

    if (p.market_type === 'ML') {
      result.moneyline.homeProb = predObj.home_prob || predObj.homeWinProb || 0;
      result.moneyline.drawProb = predObj.draw_prob || predObj.drawProb || 0;
      result.moneyline.awayProb = predObj.away_prob || predObj.awayWinProb || 0;
    } else if (p.market_type === 'AH') {
      result.asianHandicap.recommendedLine = predObj.ah_line || 0;
      result.asianHandicap.probability = predObj.ah_prob || 0;
      result.asianHandicap.edge = edge;
    } else if (p.market_type === 'OU') {
      result.overUnder.line = predObj.ou_line || 2.5;
      result.overUnder.overProb = predObj.over_prob || 0;
      result.overUnder.underProb = predObj.under_prob || (predObj.over_prob ? 1 - predObj.over_prob : 0);
    }
  }

  return result;
}
