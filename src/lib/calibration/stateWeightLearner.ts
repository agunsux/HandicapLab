import { MatchSimulationResult } from '../simulation/mockMatchGenerator';
import { MatchInput } from '@/services/probability.engine';

export interface StateWeights {
  bias: number;
  tempo_weight: number;
  pressure_weight: number;
  defShape_weight: number;
}

export interface StateWeightResult {
  state: string;
  weights: StateWeights | null;
  sampleSize: number;
  fallback: boolean;
}

// Simple sigmoid for gradient descent
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function getHTState(input: MatchInput): string {
  const h = input.ht_home_goals || 0;
  const a = input.ht_away_goals || 0;
  if (h === 0 && a === 0) return '0-0';
  if (h === 1 && a === 0) return '1-0';
  if (h === 0 && a === 1) return '0-1';
  if (h === 1 && a === 1) return '1-1';
  return '2+';
}

export function learnStateWeights(
  trainData: Array<{ input: MatchInput, outcome: MatchSimulationResult }>,
  minSamples: number = 50
): Record<string, StateWeightResult> {
  const states = ['0-0', '1-0', '0-1', '1-1', '2+'];
  const results: Record<string, StateWeightResult> = {};

  for (const state of states) {
    const data = trainData.filter(d => getHTState(d.input) === state);
    if (data.length < minSamples) {
      console.log(`WARNING: State ${state} has ${data.length} samples, falling back to global model`);
      results[state] = { state, weights: null, sampleSize: data.length, fallback: true };
      continue;
    }

    // gradient descent to learn weights for this state
    let bias = 0, wTempo = 0, wPressure = 0, wDefShape = 0;
    const lr = 0.05;
    const epochs = 200;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let gBias = 0, gTempo = 0, gPressure = 0, gDefShape = 0;
      for (const d of data) {
        const tempo = (d.input.domain_tempo || 0) * -1; // negative tempo is 'low tempo'
        const pressure = d.input.domain_pressure || 0;
        const defShape = (d.input.domain_defensiveShapeHome || 0) + (d.input.domain_defensiveShapeAway || 0);
        
        const logit = bias + wTempo * tempo + wPressure * pressure + wDefShape * defShape;
        const p = sigmoid(logit);
        const actual = d.outcome.shTotalGoals < (d.input.sh_ou_line || 1.0) ? 1 : 0;
        const error = p - actual;

        gBias += error;
        gTempo += error * tempo;
        gPressure += error * pressure;
        gDefShape += error * defShape;
      }

      bias -= lr * (gBias / data.length);
      wTempo -= lr * (gTempo / data.length);
      wPressure -= lr * (gPressure / data.length);
      wDefShape -= lr * (gDefShape / data.length);
    }

    results[state] = {
      state,
      weights: { bias, tempo_weight: wTempo, pressure_weight: wPressure, defShape_weight: wDefShape },
      sampleSize: data.length,
      fallback: false
    };
  }

  return results;
}
