// HandicapLab Performance Aggregator
// Location: src/lib/paper-trading/performanceAggregator.ts

import { PredictionLedgerRepository } from '../data/predictionLedgerRepository';

export interface PerformanceStats {
  totalPredictions: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  roi: number;
  yield: number;
  avgEV: number;
  avgCLV: number;
  avgConfidence: number;
  avgRecommendationScore: number;
  premiumBetRoi: number;
  valueBetRoi: number;
  leanRoi: number;
  noBetCount: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  recommendationBreakdown: Record<string, number>;
}

export interface ModelComparisonStats {
  modelId: string;
  roi: number;
  yield: number;
  logLoss: number;
  brierScore: number;
  count: number;
}

export class PerformanceAggregator {
  /**
   * Aggregates paper trading metrics from the prediction ledger.
   */
  public static async aggregate(): Promise<PerformanceStats> {
    const predictions = await PredictionLedgerRepository.getAllPredictions();
    const settled = predictions.filter(
      (p) => p.prediction_settlements_v3 && p.prediction_settlements_v3.length > 0
    );

    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let totalProfit = 0;
    let totalStake = 0;
    let totalEV = 0;
    let totalCLV = 0;
    let totalConfidence = 0;
    let totalRecScore = 0;

    let premiumProfit = 0;
    let premiumStake = 0;
    let valueProfit = 0;
    let valueStake = 0;
    let leanProfit = 0;
    let leanStake = 0;
    let noBetCount = 0;

    const confidenceDistribution = { high: 0, medium: 0, low: 0 };
    const recommendationBreakdown: Record<string, number> = {
      'NO BET': 0,
      'LEAN': 0,
      'VALUE BET': 0,
      'PREMIUM BET': 0
    };

    predictions.forEach((p) => {
      const expJson = p.explainability_json || {};
      const rec = expJson.recommendation || 'NO BET';
      recommendationBreakdown[rec] = (recommendationBreakdown[rec] || 0) + 1;

      if (rec === 'NO BET') noBetCount++;

      const conf = expJson.confidence || 50;
      if (conf >= 80) confidenceDistribution.high++;
      else if (conf >= 60) confidenceDistribution.medium++;
      else confidenceDistribution.low++;
    });

    settled.forEach((p) => {
      const settlement = p.prediction_settlements_v3[0];
      const status = settlement.status;
      const profitLoss = settlement.profit_loss;
      const stake = p.risk_adjusted_stake || 2.5;

      if (status === 'won') wins++;
      else if (status === 'lost') losses++;
      else if (status === 'void') pushes++;

      totalProfit += profitLoss;
      totalStake += stake;

      const expJson = p.explainability_json || {};
      totalEV += expJson.expectedValue || 0;
      totalCLV += settlement.actual_clv || 0;
      totalConfidence += expJson.confidence || 0;
      totalRecScore += expJson.recommendationScore || 0;

      const rec = expJson.recommendation || 'NO BET';
      if (rec === 'PREMIUM BET') {
        premiumProfit += profitLoss;
        premiumStake += stake;
      } else if (rec === 'VALUE BET') {
        valueProfit += profitLoss;
        valueStake += stake;
      } else if (rec === 'LEAN') {
        leanProfit += profitLoss;
        leanStake += stake;
      }
    });

    const totalSettled = settled.length;
    const winRate = totalSettled - pushes > 0 ? wins / (totalSettled - pushes) : 0;
    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    const yieldPct = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

    return {
      totalPredictions: predictions.length,
      wins,
      losses,
      pushes,
      winRate: Number((winRate * 100).toFixed(2)),
      roi: Number(roi.toFixed(2)),
      yield: Number(yieldPct.toFixed(2)),
      avgEV: totalSettled > 0 ? Number((totalEV / totalSettled).toFixed(2)) : 0,
      avgCLV: totalSettled > 0 ? Number(((totalCLV / totalSettled) * 100).toFixed(2)) : 0,
      avgConfidence: totalSettled > 0 ? Number((totalConfidence / totalSettled).toFixed(2)) : 50,
      avgRecommendationScore: totalSettled > 0 ? Number((totalRecScore / totalSettled).toFixed(2)) : 0,
      premiumBetRoi: premiumStake > 0 ? Number(((premiumProfit / premiumStake) * 100).toFixed(2)) : 0,
      valueBetRoi: valueStake > 0 ? Number(((valueProfit / valueStake) * 100).toFixed(2)) : 0,
      leanRoi: leanStake > 0 ? Number(((leanProfit / leanStake) * 100).toFixed(2)) : 0,
      noBetCount,
      confidenceDistribution,
      recommendationBreakdown
    };
  }

  /**
   * Compares the performance statistics of all individual sub-models.
   */
  public static async compareModels(): Promise<ModelComparisonStats[]> {
    const predictions = await PredictionLedgerRepository.getAllPredictions();
    
    // Group prediction settlements by model source
    // Since our submodels predictions are saved inside the individualPredictions mapping of ensemble-engine,
    // we can calculate sub-model specific wins/losses based on their individual probabilities.
    const models = ['poisson', 'dixonColes', 'elo', 'logistic', 'xg', 'market'];
    const comparison: ModelComparisonStats[] = models.map((modelId) => {
      const wins = 0;
      let totalProfit = 0;
      let totalStake = 0;
      let totalLogLoss = 0;
      let totalBrier = 0;
      let count = 0;

      predictions.forEach((p) => {
        const settlement = p.prediction_settlements_v3?.[0];
        if (!settlement) return;

        const individual = p.explainability_json?.individualPredictions?.[modelId];
        if (!individual) return;

        count++;

        // Determine selection outcome based on the model's highest probability
        const probHome = individual.homeProbability;
        const probDraw = individual.drawProbability;
        const probAway = individual.awayProbability;

        let modelSelection = 'home';
        let modelProb = probHome;
        if (probDraw > probHome && probDraw > probAway) {
          modelSelection = 'draw';
          modelProb = probDraw;
        } else if (probAway > probHome && probAway > probDraw) {
          modelSelection = 'away';
          modelProb = probAway;
        }

        const matchId = p.match_id;
        const status = settlement.status;

        // Model win/loss check
        let isWin = false;
        if (p.market_type === 'ML') {
          isWin = status === 'won' && modelSelection === p.selection;
        } else {
          isWin = status === 'won';
        }

        const stake = 2.5; // Fixed unit stake for comparison
        const profit = isWin ? stake * (p.market_odds - 1) : -stake;
        totalProfit += profit;
        totalStake += stake;

        const outcomeValue = isWin ? 1.0 : 0.0;
        totalBrier += Math.pow(modelProb - outcomeValue, 2);
        totalLogLoss += outcomeValue === 1.0 
          ? -Math.log(Math.max(0.001, modelProb)) 
          : -Math.log(Math.max(0.001, 1 - modelProb));
      });

      return {
        modelId,
        roi: totalStake > 0 ? Number(((totalProfit / totalStake) * 100).toFixed(2)) : 0,
        yield: totalStake > 0 ? Number(((totalProfit / totalStake) * 100).toFixed(2)) : 0,
        logLoss: count > 0 ? Number((totalLogLoss / count).toFixed(4)) : 0,
        brierScore: count > 0 ? Number((totalBrier / count).toFixed(4)) : 0,
        count
      };
    });

    return comparison;
  }
}
