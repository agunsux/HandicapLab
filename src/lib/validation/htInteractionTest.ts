import { MatchSimulationResult } from '../simulation/mockMatchGenerator';
import { PredictionOutput, MatchInput } from '@/services/probability.engine';
import { calculateBrierScore } from './calibration';
import { sigmoid } from '../calibration/temperatureScaling';

export interface InteractionTestResult {
  interactionName: string;
  baseBrier: number;
  newBrier: number;
  baseRoi: number;
  newRoi: number;
  brierImprovement: number;
  roiImprovement: number;
  isSignificant: boolean;
  stateCoefficients: Record<string, number>;
}

export function runHTInteractionTest(
  trainResults: Array<{ input: MatchInput, pred: PredictionOutput, outcome: MatchSimulationResult }>,
  valResults: Array<{ input: MatchInput, pred: PredictionOutput, outcome: MatchSimulationResult }>,
  featureName: string,
  featureExtractor: (input: MatchInput) => number
): InteractionTestResult {

  const states = ['0-0', '1-0', '1-1', '2+'];
  const coefficients: Record<string, number> = { '0-0': 0, '1-0': 0, '1-1': 0, '2+': 0 };

  // Learn coefficient for each state on training set
  for (const state of states) {
    const trainData = trainResults.filter(r => (r.pred.htScoreState || '2+') === state);
    if (trainData.length === 0) continue;

    let C = 0;
    const lr = 0.1;
    const epochs = 100;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let gradC = 0;
      for (const d of trainData) {
        // we use the pre-calibrated prob as base? No, the pred.sh_ou_under_prob is ALREADY calibrated by batchRunner!
        // wait, we should apply C to the logit
        // To extract the calibrated logit:
        const p_base = d.pred.sh_ou_under_prob;
        const base_logit = Math.log(p_base / (1 - p_base));
        const f_val = featureExtractor(d.input);
        const actual = d.outcome.shTotalGoals < (d.input.sh_ou_line || 1.0) ? 1 : 0;
        
        const p = sigmoid(base_logit + C * f_val);
        const error = p - actual;
        gradC += error * f_val;
      }
      C -= lr * (gradC / trainData.length);
    }
    coefficients[state] = C;
  }

  // Evaluate on validation set
  let baseHits = 0;
  let baseTotalRisk = 0;
  let baseProfit = 0;
  
  let newHits = 0;
  let newTotalRisk = 0;
  let newProfit = 0;

  const basePairs: { probability: number, actual: number }[] = [];
  const newPairs: { probability: number, actual: number }[] = [];

  for (const d of valResults) {
    const state = d.pred.htScoreState || '2+';
    const f_val = featureExtractor(d.input);
    const C = coefficients[state] || 0;

    const p_base = Math.max(0.001, Math.min(0.999, d.pred.sh_ou_under_prob));
    const base_logit = Math.log(p_base / (1 - p_base));
    const p_new = sigmoid(base_logit + C * f_val);
    
    const actual = d.outcome.shTotalGoals < (d.input.sh_ou_line || 1.0) ? 1 : 0;
    const odds = d.input.sh_ou_odds_under || 1.91;

    basePairs.push({ probability: p_base, actual });
    newPairs.push({ probability: p_new, actual });

    if (p_base * odds > 1) {
      baseTotalRisk++;
      baseProfit += actual ? (odds - 1) : -1;
    }

    if (p_new * odds > 1) {
      newTotalRisk++;
      newProfit += actual ? (odds - 1) : -1;
    }
  }

  const baseBrier = calculateBrierScore(basePairs.map(p => ({ prob: p.probability, outcome: p.actual })));
  const newBrier = calculateBrierScore(newPairs.map(p => ({ prob: p.probability, outcome: p.actual })));
  
  const baseRoi = baseTotalRisk > 0 ? baseProfit / baseTotalRisk : 0;
  const newRoi = newTotalRisk > 0 ? newProfit / newTotalRisk : 0;

  const brierImprovement = baseBrier - newBrier;
  const roiImprovement = newRoi - baseRoi;

  // Flag significant interactions (>0.5% Brier or >1% ROI improvement)
  const isSignificant = brierImprovement > 0.005 || roiImprovement > 0.01;

  return {
    interactionName: `${featureName} x htScore`,
    baseBrier,
    newBrier,
    baseRoi,
    newRoi,
    brierImprovement,
    roiImprovement,
    isSignificant,
    stateCoefficients: coefficients
  };
}
