// EPIC 37 — Layer 2: Calibration Laboratory Engine
// Computes Brier Score, Log Loss, ECE, MCE, and probability reliability bucket diagrams.

export interface ProbabilityBucketItem {
  bucketRange: string;
  minProb: number;
  maxProb: number;
  predictedCount: number;
  observedWins: number;
  meanPredictedProb: number;
  observedHitRate: number;
  calibrationError: number;
}

export interface CalibrationReport {
  modelVersion: string;
  league: string;
  sampleSize: number;
  brierScore: number;
  logLoss: number;
  ece: number; // Expected Calibration Error
  mce: number; // Maximum Calibration Error
  buckets: ProbabilityBucketItem[];
  calculatedAt: string;
}

export class CalibrationLaboratoryEngine {
  /** Compute full calibration suite over dataset of (predictedProb, actualOutcome) */
  static computeCalibrationReport(
    predictions: Array<{ predictedProb: number; actualOutcome: 1 | 0 }>,
    modelVersion: string = 'v1.37.0',
    league: string = 'ALL'
  ): CalibrationReport {
    const N = predictions.length;
    if (N === 0) {
      return {
        modelVersion,
        league,
        sampleSize: 0,
        brierScore: 0,
        logLoss: 0,
        ece: 0,
        mce: 0,
        buckets: [],
        calculatedAt: new Date().toISOString(),
      };
    }

    // 1. Brier Score & Log Loss
    let brierSum = 0;
    let logLossSum = 0;
    const eps = 1e-15;

    for (const p of predictions) {
      const prob = Math.min(Math.max(p.predictedProb, eps), 1 - eps);
      brierSum += Math.pow(prob - p.actualOutcome, 2);
      logLossSum += -(p.actualOutcome * Math.log(prob) + (1 - p.actualOutcome) * Math.log(1 - prob));
    }

    const brierScore = Number((brierSum / N).toFixed(4));
    const logLoss = Number((logLossSum / N).toFixed(4));

    // 2. 10 Probability Buckets (0-10%, 10-20%, ..., 90-100%)
    const numBuckets = 10;
    const buckets: ProbabilityBucketItem[] = [];
    let eceSum = 0;
    let mce = 0;

    for (let b = 0; b < numBuckets; b++) {
      const minProb = b / numBuckets;
      const maxProb = (b + 1) / numBuckets;
      const inBucket = predictions.filter(
        p => p.predictedProb >= minProb && (b === numBuckets - 1 ? p.predictedProb <= maxProb : p.predictedProb < maxProb)
      );

      const count = inBucket.length;
      if (count === 0) {
        buckets.push({
          bucketRange: `${(minProb * 100).toFixed(0)}%-${(maxProb * 100).toFixed(0)}%`,
          minProb,
          maxProb,
          predictedCount: 0,
          observedWins: 0,
          meanPredictedProb: (minProb + maxProb) / 2,
          observedHitRate: 0,
          calibrationError: 0,
        });
        continue;
      }

      const observedWins = inBucket.reduce((sum, item) => sum + item.actualOutcome, 0);
      const meanPredictedProb = Number((inBucket.reduce((sum, item) => sum + item.predictedProb, 0) / count).toFixed(4));
      const observedHitRate = Number((observedWins / count).toFixed(4));
      const absDiff = Math.abs(meanPredictedProb - observedHitRate);

      eceSum += (count / N) * absDiff;
      if (absDiff > mce) mce = absDiff;

      buckets.push({
        bucketRange: `${(minProb * 100).toFixed(0)}%-${(maxProb * 100).toFixed(0)}%`,
        minProb,
        maxProb,
        predictedCount: count,
        observedWins,
        meanPredictedProb,
        observedHitRate,
        calibrationError: Number(absDiff.toFixed(4)),
      });
    }

    return {
      modelVersion,
      league,
      sampleSize: N,
      brierScore,
      logLoss,
      ece: Number(eceSum.toFixed(4)),
      mce: Number(mce.toFixed(4)),
      buckets,
      calculatedAt: new Date().toISOString(),
    };
  }
}
