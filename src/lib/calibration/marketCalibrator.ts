import { fitPlattScaling, applyPlattScaling, PlattParams } from './plattScaling';
import { calculateBrierScore } from '../validation/calibration';

export interface MarketCalibrationResult {
  market: string;
  params: PlattParams;
  preCalibrationECE: number;
  postCalibrationECE: number;
  brierScore: number;
  sampleSize: number;
}

export function calculateECE(predictions: { probability: number; actual: number }[]): number {
  const bins = Array.from({ length: 10 }, () => ({ count: 0, predMean: 0, actualRate: 0 }));
  
  for (const p of predictions) {
    const bIdx = Math.min(9, Math.floor(p.probability * 10));
    bins[bIdx].count++;
    bins[bIdx].predMean += p.probability;
    bins[bIdx].actualRate += p.actual;
  }

  let eceSum = 0;
  const N = predictions.length;

  for (const b of bins) {
    if (b.count > 0) {
      b.predMean /= b.count;
      b.actualRate /= b.count;
      const error = Math.abs(b.predMean - b.actualRate);
      eceSum += (b.count / N) * error;
    }
  }
  return eceSum;
}

export function calibrateMarket(
  market: string,
  predictions: Array<{ logit: number; probability: number; actual: number }>
): MarketCalibrationResult {
  const logits = predictions.map(p => p.logit);
  const labels = predictions.map(p => p.actual);
  
  const params = fitPlattScaling(logits, labels);
  
  const calibrated = predictions.map(p => ({
    probability: applyPlattScaling(p.logit, params),
    actual: p.actual
  }));
  
  const preECE = calculateECE(predictions);
  const postECE = calculateECE(calibrated);
  
  const brier = calculateBrierScore(calibrated.map(p => ({ prob: p.probability, outcome: p.actual })));
  
  return {
    market,
    params,
    preCalibrationECE: preECE,
    postCalibrationECE: postECE,
    brierScore: brier,
    sampleSize: predictions.length
  };
}
