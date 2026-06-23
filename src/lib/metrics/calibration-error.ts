export interface CalibrationBucket {
  range: string;           // "0-10%", "10-20%", etc.
  expectedWinRate: number; // Mean predicted probability in the bucket
  actualWinRate: number;   // Mean actual outcome rate in the bucket
  sampleSize: number;      // Number of predictions in the bucket
}

export interface CalibrationResult {
  error: number;           // Weighted expected calibration error (ECE)
  buckets: CalibrationBucket[];
}

export class CalibrationError {
  /**
   * Calculates Expected Calibration Error (ECE) by bucketing predicted probabilities
   * and comparing expected vs actual win rates.
   * 
   * @param predictions List of predictions with predicted probability and actual outcomes (1 for win, 0 for loss)
   */
  public static calculate(predictions: Array<{ probability: number; actual: number }>): CalibrationResult {
    const totalPredictions = predictions.length;
    if (totalPredictions === 0) {
      return {
        error: 0,
        buckets: []
      };
    }

    const bucketCount = 10;
    const rawBuckets = Array.from({ length: bucketCount }, (_, i) => {
      const min = i * 0.1;
      const max = (i + 1) * 0.1;
      const range = `${Math.round(min * 100)}-${Math.round(max * 100)}%`;
      return {
        range,
        min,
        max,
        predSum: 0,
        actualSum: 0,
        sampleSize: 0
      };
    });

    // Distribute predictions into buckets
    for (const p of predictions) {
      const prob = Math.max(0, Math.min(1.0, p.probability));
      // Map to 0-9 index based on probability
      const idx = Math.min(bucketCount - 1, Math.floor(prob * 10));
      rawBuckets[idx].predSum += prob;
      rawBuckets[idx].actualSum += p.actual;
      rawBuckets[idx].sampleSize++;
    }

    let ece = 0;
    const buckets: CalibrationBucket[] = rawBuckets.map(b => {
      const expectedWinRate = b.sampleSize > 0 ? b.predSum / b.sampleSize : 0;
      const actualWinRate = b.sampleSize > 0 ? b.actualSum / b.sampleSize : 0;
      const bucketError = Math.abs(expectedWinRate - actualWinRate);

      // Accumulate Expected Calibration Error (weighted by sample size)
      ece += (b.sampleSize / totalPredictions) * bucketError;

      return {
        range: b.range,
        expectedWinRate: Number(expectedWinRate.toFixed(4)),
        actualWinRate: Number(actualWinRate.toFixed(4)),
        sampleSize: b.sampleSize
      };
    });

    return {
      error: Number(ece.toFixed(4)),
      buckets
    };
  }
}
