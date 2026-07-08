import { sigmoid } from '../math/metrics';
import { logLoss, brierScore, calculateECE } from '../math/metrics';

export interface PlattParams {
  A: number;
  B: number;
}

export type BenchmarkModelId =
  | 'CLOSING_ODDS' | 'OPENING_ODDS' | 'HOME_FAVORITE' | 'AWAY_FAVORITE'
  | 'ALWAYS_HOME' | 'ALWAYS_AWAY' | 'ALWAYS_DRAW' | 'RANDOM'
  | 'MARKET_IMPLIED' | 'FLAT_50';

export interface BenchmarkMetrics {
  roi: number; yield: number; accuracy: number;
  logLoss: number; brierScore: number; clv: number | null;
  expectedValue: number; calibrationError: number;
  totalBets: number; winningBets: number;
  totalProfit: number; totalStake: number;
}

export interface BenchmarkResult {
  modelId: BenchmarkModelId; modelName: string; metrics: BenchmarkMetrics;
}

export function calculateBenchmarkMetrics(
  predictions: Array<{ prob: number; actual: number; odds: number }>
): BenchmarkMetrics {
  const n = predictions.length;
  if (n === 0) {
    return { roi: 0, yield: 0, accuracy: 0, logLoss: 0, brierScore: 0, clv: null, expectedValue: 0, calibrationError: 0, totalBets: 0, winningBets: 0, totalProfit: 0, totalStake: 0 };
  }
  let totalProfit = 0; let totalStake = 0; let wins = 0;
  let llSum = 0; let brSum = 0; let evSum = 0;
  const probs: number[] = []; const actuals: number[] = [];

  for (const p of predictions) {
    totalStake += 1;
    if (p.actual === 1) { totalProfit += p.odds - 1; wins++; }
    else { totalProfit -= 1; }
    llSum += logLoss(p.prob, p.actual);
    brSum += brierScore(p.prob, p.actual);
    evSum += p.prob * p.odds - 1;
    probs.push(p.prob);
    actuals.push(p.actual);
  }

  return {
    roi: totalStake > 0 ? totalProfit / totalStake : 0,
    yield: totalStake > 0 ? (totalProfit / totalStake) * 100 : 0,
    accuracy: wins / n,
    logLoss: llSum / n,
    brierScore: brSum / n,
    clv: null,
    expectedValue: evSum / n,
    calibrationError: calculateECE(probs, actuals),
    totalBets: n, winningBets: wins, totalProfit, totalStake,
  };
}


export function fitPlattScaling(
  logits: number[],
  labels: number[],
  lr: number = 0.01,
  epochs: number = 500
): PlattParams {
  let A = 1.0;
  let B = 0.0;
  
  const N = logits.length;
  if (N === 0) return { A, B };

  for (let epoch = 0; epoch < epochs; epoch++) {
    let gradA = 0;
    let gradB = 0;

    for (let i = 0; i < N; i++) {
      const logit = logits[i];
      const y = labels[i];
      const p = sigmoid(A * logit + B);
      
      const error = p - y;
      gradA += error * logit;
      gradB += error;
    }

    A -= lr * (gradA / N);
    B -= lr * (gradB / N);
  }

  return { A, B };
}

export function applyPlattScaling(logit: number, params: PlattParams): number {
  return sigmoid(params.A * logit + params.B);
}
