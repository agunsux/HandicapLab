import { PredictionOutput, MatchInput, generatePrediction } from '@/services/probability.engine';
import { MatchSimulationResult } from '../simulation/mockMatchGenerator';
import { fitPlattScaling, applyPlattScaling } from '../calibration/plattScaling';
import { calculateBrierScore } from './calibration';

export interface AblationResult {
  feature: string;
  brierScoreWith: number;
  brierScoreWithout: number;
  marginalContribution: number; // positive = feature helps
  decision: 'KEEP' | 'REMOVE' | 'NEUTRAL';
}

type DatasetRecord = { pred: PredictionOutput; outcome: MatchSimulationResult; input: MatchInput };

export function runSHUnderAblation(
  trainDataset: DatasetRecord[],
  valDataset: DatasetRecord[],
  featureNames: string[],
  baselineBrier: number
): AblationResult[] {
  const results: AblationResult[] = [];
  
  for (const feature of featureNames) {
    // 1. Re-run model on train and val with the feature ablated
    const ablateInput = (input: MatchInput): MatchInput => {
      const copy = { ...input };
      if (feature === 'tempo') copy.domain_tempo = 0;
      if (feature === 'pressure') copy.domain_pressure = 0;
      if (feature === 'weather') copy.domain_weather = 0;
      if (feature === 'defShapeHome') copy.domain_defensiveShapeHome = 0;
      if (feature === 'defShapeAway') copy.domain_defensiveShapeAway = 0;
      if (feature === 'fatigueHome') copy.domain_fatigueHome = 0;
      if (feature === 'fatigueAway') copy.domain_fatigueAway = 0;
      return copy;
    };

    const ablatedTrain = trainDataset.map(d => ({
      ...d,
      pred: generatePrediction(ablateInput(d.input))
    }));
    
    const ablatedVal = valDataset.map(d => ({
      ...d,
      pred: generatePrediction(ablateInput(d.input))
    }));

    // 2. Recalibrate Market (Find optimal Platt params on ablated train set)
    const trainPairs = ablatedTrain.map(d => ({
      logit: d.pred.marketLogits.SH_UNDER,
      probability: d.pred.sh_ou_under_prob,
      actual: d.outcome.shTotalGoals < (d.input.sh_ou_line || 1.0) ? 1 : 0
    }));
    
    const trainLogits = trainPairs.map(p => p.logit);
    const trainLabels = trainPairs.map(p => p.actual);
    
    const params = fitPlattScaling(trainLogits, trainLabels);

    // 3. Apply Platt Scaling to Val set
    const valPairs = ablatedVal.map(d => ({
      probability: applyPlattScaling(d.pred.marketLogits.SH_UNDER, params),
      actual: d.outcome.shTotalGoals < (d.input.sh_ou_line || 1.0) ? 1 : 0
    }));

    const ablatedBrier = calculateBrierScore(valPairs.map(p => ({ prob: p.probability, outcome: p.actual })));
    const contribution = baselineBrier - ablatedBrier; // if ablatedBrier is > baselineBrier, contribution > 0 (feature helps)
    
    results.push({
      feature,
      brierScoreWith: baselineBrier,
      brierScoreWithout: ablatedBrier,
      marginalContribution: contribution,
      decision: contribution > 0.005 ? 'KEEP' : contribution < -0.005 ? 'REMOVE' : 'NEUTRAL'
    });
  }
  
  return results;
}
