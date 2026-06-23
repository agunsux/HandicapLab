import { PredictionOutput, MatchInput } from '@/services/probability.engine';
import { MatchSimulationResult } from '../simulation/mockMatchGenerator';

export interface BaselinesOutput {
  marketBeat: boolean;
  secondHalfUnderProfitable: boolean;
  edgeInsufficient: boolean;
  
  modelMlRoi: number;
  modelAhRoi: number;
  modelOuRoi: number;
  modelShUnderRoi: number;
  
  marketEfficiencyMlRoi: number;
  randomBaselineMlRoi: number;
  naiveFavMlRoi: number;
  
  heuristicShUnderRoi: number;
  heuristicShUnderHitRate: number;
  
  modelBrier: number;
  marketBrier: number;
  naiveFavBrier: number;
}

export function evaluateBaselines(
  results: { pred: PredictionOutput; outcome: MatchSimulationResult; input: MatchInput }[]
): BaselinesOutput {
  let modelMlProfit = 0, modelAhProfit = 0, modelOuProfit = 0, modelShProfit = 0;
  let marketMlProfit = 0, randomMlProfit = 0, naiveFavProfit = 0;
  let heuristicShProfit = 0;
  
  let shBetsCount = 0;
  let shHitsCount = 0;

  let brierModel = 0, brierMarket = 0, brierFav = 0;

  const sampleSize = results.length;
  if (sampleSize === 0) {
    return {} as any;
  }

  for (const { pred, outcome, input } of results) {
    // True outcome 1 for home win, 0 otherwise
    const trueOutcome = outcome.homeWin ? 1 : 0;
    
    // --- BRIER SCORES ---
    brierModel += Math.pow(pred.ml_home_prob - trueOutcome, 2);
    
    // Market Efficiency Prob
    const impliedHome = 1 / input.odds_home;
    const impliedDraw = 1 / input.odds_draw;
    const impliedAway = 1 / input.odds_away;
    const totalImplied = impliedHome + impliedDraw + impliedAway;
    const marketProbHome = impliedHome / totalImplied;
    brierMarket += Math.pow(marketProbHome - trueOutcome, 2);
    
    // Naive Fav Prob
    const isFav = input.odds_home <= input.odds_away;
    const favProbHome = isFav ? 1.0 : 0.0;
    brierFav += Math.pow(favProbHome - trueOutcome, 2);

    // --- ML ROI (assuming 5% vig standard -> effectively betting odds are exactly input.odds_home) ---
    // Model ML
    const predictedWin = pred.ml_home_prob > Math.max(pred.ml_draw_prob, pred.ml_away_prob) ? 'home' : 
                         pred.ml_away_prob > Math.max(pred.ml_home_prob, pred.ml_draw_prob) ? 'away' : 'draw';
    
    if (predictedWin === 'home') {
      modelMlProfit += outcome.homeWin ? (input.odds_home - 1) : -1;
    } else if (predictedWin === 'away') {
      modelMlProfit += outcome.awayWin ? (input.odds_away - 1) : -1;
    } else {
      modelMlProfit += outcome.draw ? (input.odds_draw - 1) : -1;
    }
    
    // Market Efficiency ML (always bet highest market prob, effectively favorite)
    if (isFav) {
      marketMlProfit += outcome.homeWin ? (input.odds_home - 1) : -1;
      naiveFavProfit += outcome.homeWin ? (input.odds_home - 1) : -1;
    } else {
      marketMlProfit += outcome.awayWin ? (input.odds_away - 1) : -1;
      naiveFavProfit += outcome.awayWin ? (input.odds_away - 1) : -1;
    }
    
    // Random Baseline ML (weighted by market prob)
    const rand = Math.random();
    if (rand < marketProbHome) {
      randomMlProfit += outcome.homeWin ? (input.odds_home - 1) : -1;
    } else if (rand < marketProbHome + (impliedDraw / totalImplied)) {
      randomMlProfit += outcome.draw ? (input.odds_draw - 1) : -1;
    } else {
      randomMlProfit += outcome.awayWin ? (input.odds_away - 1) : -1;
    }

    // --- AH ROI (4.5% vig implies 1.91 odds) ---
    const ahOdds = 1.91;
    const homeAhScore = outcome.homeGoals + input.ah_line;
    const predictedAhWin = pred.ah_home_prob > pred.ah_away_prob;
    const ahActualHomeWin = homeAhScore > outcome.awayGoals;
    
    if (predictedAhWin) {
      modelAhProfit += ahActualHomeWin ? (ahOdds - 1) : -1;
    } else {
      modelAhProfit += !ahActualHomeWin ? (ahOdds - 1) : -1;
    }

    // --- OU ROI (4.5% vig implies 1.91 odds) ---
    const ouOdds = 1.91;
    const predictedOver = pred.ou_over_prob > pred.ou_under_prob;
    const actualOver = outcome.totalGoals > input.ou_line;
    
    if (predictedOver) {
      modelOuProfit += actualOver ? (ouOdds - 1) : -1;
    } else {
      modelOuProfit += !actualOver ? (ouOdds - 1) : -1;
    }

    // --- Second Half Under Model ---
    const shOuOdds = input.sh_ou_odds_under || 1.91;
    const shUnderPredicted = pred.sh_ou_under_prob > pred.sh_ou_over_prob;
    const shLine = input.sh_ou_line || 1.0;
    const shUnderActual = outcome.shTotalGoals < shLine;
    
    if (shUnderPredicted) {
      modelShProfit += shUnderActual ? (shOuOdds - 1) : -1;
    }

    // Simple Heuristic Baseline for SH Under
    const avgGoalsHome = input.last_5_avg_goals_home || 2;
    const avgGoalsAway = input.last_5_avg_goals_away || 2;
    if (avgGoalsHome < 1.5 && avgGoalsAway < 1.5) {
      shBetsCount++;
      if (shUnderActual) {
        shHitsCount++;
        heuristicShProfit += (shOuOdds - 1);
      } else {
        heuristicShProfit -= 1;
      }
    }
  }

  const modelMlRoi = modelMlProfit / sampleSize;
  const modelAhRoi = modelAhProfit / sampleSize;
  const modelOuRoi = modelOuProfit / sampleSize;
  const modelShUnderRoi = modelShProfit / sampleSize; // Actually modelShUnderStaked could be less, assume always betting something

  const marketEfficiencyMlRoi = marketMlProfit / sampleSize;
  const randomBaselineMlRoi = randomMlProfit / sampleSize;
  const naiveFavMlRoi = naiveFavProfit / sampleSize;
  
  const heuristicShUnderRoi = shBetsCount > 0 ? heuristicShProfit / shBetsCount : 0;
  const heuristicShUnderHitRate = shBetsCount > 0 ? shHitsCount / shBetsCount : 0;

  const marketBeat = modelMlRoi > marketEfficiencyMlRoi;
  const secondHalfUnderProfitable = modelShUnderRoi > 0;
  
  // Checking if ANY edge is sufficient (ROI >= 2%)
  const edgeInsufficient = Math.max(modelMlRoi, modelAhRoi, modelOuRoi, modelShUnderRoi) < 0.02;

  return {
    marketBeat,
    secondHalfUnderProfitable,
    edgeInsufficient,
    modelMlRoi,
    modelAhRoi,
    modelOuRoi,
    modelShUnderRoi,
    marketEfficiencyMlRoi,
    randomBaselineMlRoi,
    naiveFavMlRoi,
    heuristicShUnderRoi,
    heuristicShUnderHitRate,
    modelBrier: brierModel / sampleSize,
    marketBrier: brierMarket / sampleSize,
    naiveFavBrier: brierFav / sampleSize
  };
}
