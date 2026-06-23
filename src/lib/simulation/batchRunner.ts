import { generateMockMatch, MatchSimulationResult } from './mockMatchGenerator';
import { generatePrediction, PredictionOutput, MatchInput } from '@/services/probability.engine';
import { generateDistributionReport, ReportMetrics } from '../validation/distributionReport';
import { validatePredictionGuards, evaluateReportGuards } from '../validation/guards';
import { calculateMarketEdge, EdgeReport } from '../validation/edgeReport';
import { evaluateBaselines, BaselinesOutput } from '../validation/baseline';
import { performFeatureAblation, AblationResult as OldAblationResult } from '../model/featureAnalysis';
import { calibrateMarket, MarketCalibrationResult } from '../calibration/marketCalibrator';
import { runSHUnderAblation, AblationResult } from '../validation/shUnderAblation';
import { applyPlattScaling, PlattParams } from '../calibration/plattScaling';
import { learnStateWeights, StateWeightResult } from '../calibration/stateWeightLearner';

function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function runSimulation(batchSize: number = 10000, seed?: number): {
  trainMetrics: ReportMetrics;
  valMetrics: ReportMetrics;
  trainBaselines: BaselinesOutput;
  valBaselines: BaselinesOutput;
  edges: EdgeReport[];
  guardStatuses: string[];
  ablation: AblationResult[];
  valResults: { pred: PredictionOutput; outcome: MatchSimulationResult; input: MatchInput }[];
  marketCalibrations: MarketCalibrationResult[];
} {
  const prng = seed !== undefined ? mulberry32(seed) : Math.random;
  
  const originalRandom = Math.random;
  Math.random = prng;

  const results: { pred: PredictionOutput; outcome: MatchSimulationResult; input: MatchInput }[] = [];
  
  let guardFailures = 0;

  for (let i = 0; i < batchSize; i++) {
    const homeStr = 0.5 + Math.random() * 2.0;
    const awayStr = 0.5 + Math.random() * 2.0;
    const { input, outcome } = generateMockMatch(homeStr, awayStr);

    const pred = generatePrediction(input);

    const errors = validatePredictionGuards(pred);
    if (errors.length > 0) {
      guardFailures++;
      if (guardFailures <= 5) {
        console.warn(`[Guard Failure Match ${i}]:`, errors.join(', '));
      }
    }

    results.push({ pred, outcome, input });
  }

  Math.random = originalRandom;

  if (guardFailures > 0) {
    console.warn(`Total prediction guard failures: ${guardFailures} out of ${batchSize}`);
  }

  // Train / Test split
  const trainSize = Math.floor(batchSize * 0.7);
  let trainResults = results.slice(0, trainSize);
  let valResults = results.slice(trainSize);

  // === NEW: Level 2 - Learn State Weights ===
  const stateWeights = learnStateWeights(trainResults);
  
  // Re-generate predictions using the state weights
  trainResults = trainResults.map(r => ({
    ...r,
    pred: generatePrediction(r.input, stateWeights)
  }));
  
  valResults = valResults.map(r => ({
    ...r,
    pred: generatePrediction(r.input, stateWeights)
  }));

  // === Level 3: Global Platt Calibration ===
  // Market Segmentation & Calibration
  const extractMarketPairs = (dataset: typeof results, market: string) => {
    return dataset.map(d => {
      let probability = 0;
      let logit = 0;
      let actual = 0;
      if (market === 'SH_UNDER') { probability = d.pred.sh_ou_under_prob; logit = d.pred.marketLogits.SH_UNDER; actual = d.outcome.shTotalGoals < (d.input.sh_ou_line || 1.0) ? 1 : 0; }
      if (market === 'FT_OU') { probability = d.pred.ou_over_prob; logit = d.pred.marketLogits.FT_OU; actual = d.outcome.totalGoals > d.input.ou_line ? 1 : 0; }
      if (market === 'AH_HOME') { probability = d.pred.ah_home_prob; logit = d.pred.marketLogits.AH_HOME; actual = d.outcome.homeGoals + d.input.ah_line > d.outcome.awayGoals ? 1 : 0; }
      if (market === 'ML_HOME') { probability = d.pred.ml_home_prob; logit = d.pred.marketLogits.ML_HOME; actual = d.outcome.homeWin ? 1 : 0; }
      return { logit, probability, actual };
    });
  };

  const markets = ['SH_UNDER', 'FT_OU', 'AH_HOME', 'ML_HOME'];
  const marketCalibrations: MarketCalibrationResult[] = [];
  const learnedParams: Record<string, PlattParams> = {};

  for (const m of markets) {
    const pairs = extractMarketPairs(trainResults, m);
    const calResult = calibrateMarket(m, pairs);
    marketCalibrations.push(calResult);
    learnedParams[m] = calResult.params;
  }

  // Apply Calibration to Validation Set
  valResults = valResults.map(r => {
    const predCopy = { ...r.pred };
    predCopy.sh_ou_under_prob = applyPlattScaling(predCopy.marketLogits.SH_UNDER, learnedParams['SH_UNDER']);
    predCopy.sh_ou_over_prob = 1 - predCopy.sh_ou_under_prob;
    
    predCopy.ou_over_prob = applyPlattScaling(predCopy.marketLogits.FT_OU, learnedParams['FT_OU']);
    predCopy.ou_under_prob = 1 - predCopy.ou_over_prob;

    predCopy.ah_home_prob = applyPlattScaling(predCopy.marketLogits.AH_HOME, learnedParams['AH_HOME']);
    predCopy.ah_away_prob = 1 - predCopy.ah_home_prob;

    predCopy.ml_home_prob = applyPlattScaling(predCopy.marketLogits.ML_HOME, learnedParams['ML_HOME']);
    predCopy.ml_away_prob = Math.max(0, 1 - predCopy.ml_home_prob - predCopy.ml_draw_prob);
    
    // Normalize if ml_home + ml_draw > 1
    if (predCopy.ml_home_prob + predCopy.ml_draw_prob > 1) {
       predCopy.ml_draw_prob = 1 - predCopy.ml_home_prob;
       predCopy.ml_away_prob = 0;
    }
    
    return { ...r, pred: predCopy };
  });

  const trainMetrics = generateDistributionReport(trainResults);
  const valMetrics = generateDistributionReport(valResults);
  const trainBaselines = evaluateBaselines(trainResults);
  const valBaselines = evaluateBaselines(valResults);
  const guardStatuses = evaluateReportGuards(valMetrics);

  const edges: EdgeReport[] = valResults.map(r => {
    const mlEdge = calculateMarketEdge('Moneyline', 'Home Win', r.pred.ml_home_prob, 1 / r.input.odds_home, 1);
    const ahEdge = calculateMarketEdge('Asian Handicap', 'Home', r.pred.ah_home_prob, 0.5, 1);
    const ouEdge = calculateMarketEdge('Over/Under', 'Over', r.pred.ou_over_prob, 0.5, 1);
    const shLine = r.input.sh_ou_line || 1.0;
    const shImplied = 1 / (r.input.sh_ou_odds_under || 1.91);
    const shEdge = calculateMarketEdge('Second Half Under', `Under ${shLine}`, r.pred.sh_ou_under_prob, shImplied, 1);
    return [mlEdge, ahEdge, ouEdge, shEdge];
  }).flat();

  // Post-Calibration Ablation for SH_UNDER
  const shUnderBrier = marketCalibrations.find(m => m.market === 'SH_UNDER')?.brierScore || 0; // Wait, we need validation Brier score
  const valShUnderPairs = extractMarketPairs(valResults, 'SH_UNDER');
  const baselineBrier = valShUnderPairs.reduce((sum, p) => sum + Math.pow(p.probability - p.actual, 2), 0) / valShUnderPairs.length;

  const ablation = runSHUnderAblation(
    trainResults, 
    valResults, 
    ['tempo', 'pressure', 'weather', 'defShapeHome', 'defShapeAway', 'fatigueHome', 'fatigueAway'],
    baselineBrier
  );

  return { trainMetrics, valMetrics, trainBaselines, valBaselines, edges, guardStatuses, ablation, valResults, trainResults, marketCalibrations, stateWeights };
}
