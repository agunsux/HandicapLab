import { fitPlattScaling, applyPlattScaling, PlattParams } from './plattScaling';
import { calculateECE, brierScore } from '../math/metrics';

export interface MarketCalibrationResult {
  market: string;
  params: PlattParams;
  preCalibrationECE: number;
  postCalibrationECE: number;
  brierScore: number;
  sampleSize: number;
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
  
  const preECE = calculateECE(predictions.map(p => p.probability), predictions.map(p => p.actual));
  const postECE = calculateECE(calibrated.map(p => p.probability), calibrated.map(p => p.actual));
  
  const brierSum = calibrated.reduce((sum, p) => sum + brierScore(p.probability, p.actual), 0);
  const brier = calibrated.length > 0 ? brierSum / calibrated.length : 0;
  
  return {
    market,
    params,
    preCalibrationECE: preECE,
    postCalibrationECE: postECE,
    brierScore: brier,
    sampleSize: predictions.length
  };
}
