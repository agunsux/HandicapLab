export interface CalibrationBucket {
  bucket: string;
  predictionMean: number;
  actualRate: number;
  sampleSize: number;
  calibrationError: number;
}

export function calculateBrierScore(predictions: { prob: number; outcome: number }[]): number {
  if (predictions.length === 0) return 0;
  let sum = 0;
  for (const { prob, outcome } of predictions) {
    sum += Math.pow(prob - outcome, 2);
  }
  return sum / predictions.length;
}

export function createCalibrationBuckets(predictions: { prob: number; outcome: number }[]): CalibrationBucket[] {
  const buckets: { [key: string]: { probs: number[]; outcomes: number[] } } = {};
  
  for (let i = 0; i < 10; i++) {
    const min = i * 10;
    const max = (i + 1) * 10;
    buckets[`${min}-${max}%`] = { probs: [], outcomes: [] };
  }

  for (const { prob, outcome } of predictions) {
    const probPercent = prob * 100;
    const bucketIndex = probPercent >= 100 ? 9 : Math.floor(probPercent / 10);
    const min = bucketIndex * 10;
    const max = (bucketIndex + 1) * 10;
    const bucketKey = `${min}-${max}%`;
    
    if (buckets[bucketKey]) {
      buckets[bucketKey].probs.push(prob);
      buckets[bucketKey].outcomes.push(outcome);
    }
  }

  return Object.keys(buckets).map(key => {
    const { probs, outcomes } = buckets[key];
    const sampleSize = probs.length;
    
    if (sampleSize === 0) {
      return {
        bucket: key,
        predictionMean: 0,
        actualRate: 0,
        sampleSize: 0,
        calibrationError: 0
      };
    }
    
    const predictionMean = probs.reduce((a, b) => a + b, 0) / sampleSize;
    const actualRate = outcomes.reduce((a, b) => a + b, 0) / sampleSize;
    const calibrationError = Math.abs(predictionMean - actualRate);
    
    return {
      bucket: key,
      predictionMean,
      actualRate,
      sampleSize,
      calibrationError
    };
  });
}
