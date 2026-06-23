import { PredictionOutput } from '@/services/probability.engine';
import { MatchSimulationResult } from '../simulation/mockMatchGenerator';
import { calculateBrierScore, createCalibrationBuckets, CalibrationBucket } from './calibration';

export interface ReportMetrics {
  sampleSize: number;
  winAccuracy: number;
  ahAccuracy: number;
  ouAccuracy: number;
  homeBias: number;
  overBias: number;
  bttsMean: number;
  varianceStable: boolean;
  brierScore: number;
  calibrationError: number;
  calibrationBuckets: CalibrationBucket[];
  markets: {
    AH: { accuracy: number; total: number };
    OU: { accuracy: number; total: number };
    ML: { accuracy: number; total: number };
  };
}

export function generateDistributionReport(
  results: { pred: PredictionOutput; outcome: MatchSimulationResult; input: any }[]
): ReportMetrics {
  let winCorrect = 0;
  let ahCorrect = 0;
  let ouCorrect = 0;

  let totalHomeProb = 0;
  let actualHomeWins = 0;

  let totalOverProb = 0;
  let actualOvers = 0;

  let totalBttsProb = 0;

  const brierPredictions: { prob: number; outcome: number }[] = [];

  for (const { pred, outcome, input } of results) {
    const predictedWin = pred.ml_home_prob > Math.max(pred.ml_draw_prob, pred.ml_away_prob) ? 'home' : 
                         pred.ml_away_prob > Math.max(pred.ml_home_prob, pred.ml_draw_prob) ? 'away' : 'draw';
    const actualWin = outcome.homeWin ? 'home' : outcome.awayWin ? 'away' : 'draw';
    if (predictedWin === actualWin) winCorrect++;

    // Track Brier against SH Under predictions
    const shLine = input.sh_ou_line || 1.0;
    const shUnderActual = outcome.shTotalGoals < shLine;
    brierPredictions.push({ prob: pred.sh_ou_under_prob, outcome: shUnderActual ? 1 : 0 });

    const homeAhScore = outcome.homeGoals + input.ah_line;
    const homeAhWin = homeAhScore > outcome.awayGoals;
    const predictedAhWin = pred.ah_home_prob > pred.ah_away_prob;
    if (predictedAhWin === homeAhWin) ahCorrect++;

    const actualOver = outcome.totalGoals > input.ou_line;
    const predictedOver = pred.ou_over_prob > pred.ou_under_prob;
    if (predictedOver === actualOver) ouCorrect++;

    totalHomeProb += pred.ml_home_prob;
    if (outcome.homeWin) actualHomeWins++;

    totalOverProb += pred.ou_over_prob;
    if (actualOver) actualOvers++;

    totalBttsProb += pred.btts_yes_prob;
  }

  const sampleSize = results.length;
  if (sampleSize === 0) {
    return {
      sampleSize: 0, winAccuracy: 0, ahAccuracy: 0, ouAccuracy: 0,
      homeBias: 0, overBias: 0, bttsMean: 0, varianceStable: false,
      brierScore: 0, calibrationError: 0, calibrationBuckets: [],
      markets: {
        AH: { accuracy: 0, total: 0 },
        OU: { accuracy: 0, total: 0 },
        ML: { accuracy: 0, total: 0 }
      }
    };
  }

  const avgHomeProb = totalHomeProb / sampleSize;
  const actualHomeFreq = actualHomeWins / sampleSize;
  const homeBias = avgHomeProb - actualHomeFreq;

  const avgOverProb = totalOverProb / sampleSize;
  const actualOverFreq = actualOvers / sampleSize;
  const overBias = avgOverProb - actualOverFreq;

  const varianceStable = Math.abs(homeBias) < 0.1 && Math.abs(overBias) < 0.1;

  const brierScore = calculateBrierScore(brierPredictions);
  const calibrationBuckets = createCalibrationBuckets(brierPredictions);
  const calibrationError = calibrationBuckets.reduce((sum, b) => sum + b.calibrationError, 0) / calibrationBuckets.length;

  return {
    sampleSize,
    winAccuracy: winCorrect / sampleSize,
    ahAccuracy: ahCorrect / sampleSize,
    ouAccuracy: ouCorrect / sampleSize,
    homeBias,
    overBias,
    bttsMean: totalBttsProb / sampleSize,
    varianceStable,
    brierScore,
    calibrationError,
    calibrationBuckets,
    markets: {
      AH: { accuracy: ahCorrect / sampleSize, total: sampleSize },
      OU: { accuracy: ouCorrect / sampleSize, total: sampleSize },
      ML: { accuracy: winCorrect / sampleSize, total: sampleSize }
    }
  };
}
