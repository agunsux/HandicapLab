import { PredictionOutput } from '@/services/probability.engine';

export function validatePredictionGuards(pred: PredictionOutput): string[] {
  const errors: string[] = [];

  const mlSum = pred.ml_home_prob + pred.ml_draw_prob + pred.ml_away_prob;
  if (Math.abs(mlSum - 1) > 0.001) {
    errors.push(`ML probabilities do not sum to 1 (sum: ${mlSum})`);
  }

  const ouSum = pred.ou_over_prob + pred.ou_under_prob;
  if (Math.abs(ouSum - 1) > 0.001) {
    errors.push(`O/U probabilities do not sum to 1 (sum: ${ouSum})`);
  }

  const ahSum = pred.ah_home_prob + pred.ah_away_prob;
  if (Math.abs(ahSum - 1) > 0.001) {
    errors.push(`AH probabilities do not sum to 1 (sum: ${ahSum})`);
  }

  const bttsSum = pred.btts_yes_prob + pred.btts_no_prob;
  if (Math.abs(bttsSum - 1) > 0.001) {
    errors.push(`BTTS probabilities do not sum to 1 (sum: ${bttsSum})`);
  }

  if (Object.values(pred).some(v => typeof v === 'number' && v < 0)) {
    errors.push('Negative probability detected');
  }

  if (Object.values(pred).some(v => v === undefined || v === null || Number.isNaN(v))) {
    errors.push('Missing or NaN probability detected');
  }

  return errors;
}

export function validateOddsSanity(impliedProb: number, offeredOdds: number): boolean {
  if (offeredOdds <= 1.0) return false;
  const offeredProb = 1 / offeredOdds;
  if (Math.abs(impliedProb - offeredProb) > 0.5) return false;
  return true;
}

import { ReportMetrics } from './distributionReport';

export function evaluateReportGuards(metrics: ReportMetrics): string[] {
  const statuses: string[] = [];

  if (metrics.sampleSize < 500) {
    statuses.push('INSUFFICIENT_DATA');
  }

  // 0.1 threshold for demonstration
  if (metrics.calibrationError > 0.1) {
    statuses.push('MODEL_UNCALIBRATED');
  }

  if (!metrics.varianceStable) {
    statuses.push('VARIANCE_UNSTABLE');
  }

  return statuses;
}

