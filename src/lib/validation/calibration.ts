/**
 * HandicapLab Calibration Analysis
 * =================================
 * Reliability diagrams, calibration curves, ECE, MCE, sharpness.
 *
 * All functions are pure — no side effects.
 * No production code is modified.
 */

export interface CalibrationBin {
  binStart: number;
  binEnd: number;
  count: number;
  meanPredicted: number;
  meanObserved: number;
  confidence: number; // 1 / sqrt(count)
}

export interface CalibrationReport {
  bins: CalibrationBin[];
  ece: number;         // Expected Calibration Error
  mce: number;         // Maximum Calibration Error
  sharpness: number;
  confidenceHistogram: Array<{ binStart: number; binEnd: number; count: number }>;
}

const BIN_COUNT = 10;

/**
 * Calculate Brier Score from an array of probability/outcome pairs.
 * Brier Score = mean((prob - actual)^2)
 */
export function calculateBrierScore(
  pairs: { prob: number; outcome: number }[]
): number {
  if (pairs.length === 0) return 0;
  return pairs.reduce((sum, p) => sum + (p.prob - p.outcome) ** 2, 0) / pairs.length;
}

export interface CalibrationBucket {
  binStart: number;
  binEnd: number;
  count: number;
  meanPredicted: number;
  meanObserved: number;
  calibrationError: number;
}

/**
 * Create calibration buckets from probability/outcome pairs.
 */
export function createCalibrationBuckets(
  pairs: { prob: number; outcome: number }[],
  binCount: number = 10
): CalibrationBucket[] {
  const binSize = 1.0 / binCount;
  const binCounts = new Array(binCount).fill(0);
  const binPredSums = new Array(binCount).fill(0);
  const binObsSums = new Array(binCount).fill(0);

  for (const p of pairs) {
    const prob = Math.max(0, Math.min(1, p.prob));
    const binIndex = Math.min(binCount - 1, Math.floor(prob / binSize));
    binCounts[binIndex]++;
    binPredSums[binIndex] += prob;
    binObsSums[binIndex] += p.outcome;
  }

  const buckets: CalibrationBucket[] = [];
  for (let i = 0; i < binCount; i++) {
    const count = binCounts[i];
    const binStart = i * binSize;
    const binEnd = (i + 1) * binSize;
    if (count === 0) {
      buckets.push({ binStart, binEnd, count: 0, meanPredicted: 0, meanObserved: 0, calibrationError: 0 });
    } else {
      const meanPredicted = binPredSums[i] / count;
      const meanObserved = binObsSums[i] / count;
      buckets.push({
        binStart,
        binEnd,
        count,
        meanPredicted: Math.round(meanPredicted * 10000) / 10000,
        meanObserved: Math.round(meanObserved * 10000) / 10000,
        calibrationError: Math.abs(meanPredicted - meanObserved),
      });
    }
  }
  return buckets;
}

export function computeCalibration(
  predictedProbabilities: number[],
  actualOutcomes: number[]  // 1 = event occurred, 0 = did not occur
): CalibrationReport {
  if (predictedProbabilities.length === 0) {
    throw new Error('Cannot compute calibration on empty input');
  }

  const n = predictedProbabilities.length;
  const binSize = 1.0 / BIN_COUNT;

  // Initialize bins
  const binCounts = new Array(BIN_COUNT).fill(0);
  const binPredSums = new Array(BIN_COUNT).fill(0);
  const binObsSums = new Array(BIN_COUNT).fill(0);

  // Assign each prediction to a bin
  for (let i = 0; i < n; i++) {
    const p = Math.max(0, Math.min(1, predictedProbabilities[i]));
    const binIndex = Math.min(BIN_COUNT - 1, Math.floor(p / binSize));
    binCounts[binIndex]++;
    binPredSums[binIndex] += p;
    binObsSums[binIndex] += actualOutcomes[i];
  }

  const bins: CalibrationBin[] = [];
  let ece = 0;
  let mce = 0;

  for (let i = 0; i < BIN_COUNT; i++) {
    const count = binCounts[i];
    const binStart = i * binSize;
    const binEnd = (i + 1) * binSize;

    if (count === 0) {
      bins.push({ binStart, binEnd, count: 0, meanPredicted: 0, meanObserved: 0, confidence: 0 });
      continue;
    }

    const meanPredicted = binPredSums[i] / count;
    const meanObserved = binObsSums[i] / count;
    const diff = Math.abs(meanPredicted - meanObserved);
    const binEce = diff * (count / n);

    bins.push({
      binStart,
      binEnd,
      count,
      meanPredicted: Math.round(meanPredicted * 10000) / 10000,
      meanObserved: Math.round(meanObserved * 10000) / 10000,
      confidence: Math.round((1 / Math.sqrt(count)) * 10000) / 10000,
    });

    ece += binEce;
    if (diff > mce) mce = diff;
  }

  // Sharpness: average width of confidence intervals
  const sharpness = bins.reduce((sum, b) => {
    if (b.count === 0) return sum;
    return sum + (b.meanPredicted * (1 - b.meanPredicted)) / b.count;
  }, 0) / bins.filter((b) => b.count > 0).length;

  // Confidence histogram
  const histBinSize = 1.0 / BIN_COUNT;
  const histCounts = new Array(BIN_COUNT).fill(0);
  for (const p of predictedProbabilities) {
    const idx = Math.min(BIN_COUNT - 1, Math.floor(Math.max(0, Math.min(1, p)) / histBinSize));
    histCounts[idx]++;
  }
  const confidenceHistogram = histCounts.map((count, i) => ({
    binStart: i * histBinSize,
    binEnd: (i + 1) * histBinSize,
    count,
  }));

  return {
    bins,
    ece: Math.round(ece * 10000) / 10000,
    mce: Math.round(mce * 10000) / 10000,
    sharpness: Math.round(sharpness * 10000) / 10000,
    confidenceHistogram,
  };
}