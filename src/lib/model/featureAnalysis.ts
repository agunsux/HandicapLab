import { Feature, calculateFeatureScore, sigmoid } from './features';
import { calculateBrierScore } from '../validation/calibration';

export interface AblationResult {
  featureName: string;
  baseBrier: number;
  ablatedBrier: number;
  improvement: number; 
  unstable: boolean;
  correlation: number;
}

export function performFeatureAblation(
  dataset: { features: Feature[]; outcome: number }[] 
): AblationResult[] {
  if (dataset.length === 0) return [];
  
  const basePredictions = dataset.map(d => ({
    prob: sigmoid(calculateFeatureScore(d.features)),
    outcome: d.outcome
  }));
  const baseBrier = calculateBrierScore(basePredictions);

  const featureNames = Array.from(new Set(dataset[0].features.map(f => f.name)));
  const results: AblationResult[] = [];

  for (const fName of featureNames) {
    const ablatedPredictions = dataset.map(d => {
      const ablatedFeatures = d.features.map(f => f.name === fName ? { ...f, value: 0 } : f);
      return {
        prob: sigmoid(calculateFeatureScore(ablatedFeatures)),
        outcome: d.outcome
      };
    });

    const ablatedBrier = calculateBrierScore(ablatedPredictions);
    // If ablatedBrier is > baseBrier, then the feature improved the model by (ablated - base)
    const improvement = ablatedBrier - baseBrier;

    let sumF = 0, sumO = 0, sumFO = 0, sumF2 = 0, sumO2 = 0;
    const N = dataset.length;
    for (const d of dataset) {
      const fVal = d.features.find(f => f.name === fName)?.value || 0;
      const oVal = d.outcome;
      sumF += fVal; sumO += oVal;
      sumFO += fVal * oVal;
      sumF2 += fVal * fVal;
      sumO2 += oVal * oVal;
    }
    const numerator = (N * sumFO) - (sumF * sumO);
    const denominator = Math.sqrt((N * sumF2 - sumF * sumF) * (N * sumO2 - sumO * sumO));
    const correlation = denominator === 0 ? 0 : numerator / denominator;

    results.push({
      featureName: fName,
      baseBrier,
      ablatedBrier,
      improvement,
      unstable: improvement < 0 || Math.abs(improvement) < 0.001,
      correlation
    });
  }

  return results;
}
