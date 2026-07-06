export interface StabilityMetrics {
  meanROI: number;
  stdROI: number;
  minROI: number;
  maxROI: number;
  ciROI: [number, number];
}

export class StabilityAnalyzer {
  analyze(foldROIs: number[]): StabilityMetrics {
    const mean = foldROIs.reduce((a, b) => a + b, 0) / foldROIs.length;
    const sqDiffs = foldROIs.map(roi => Math.pow(roi - mean, 2));
    const variance = sqDiffs.reduce((a, b) => a + b, 0) / foldROIs.length;
    const std = Math.sqrt(variance);
    const min = Math.min(...foldROIs);
    const max = Math.max(...foldROIs);
    
    // 95% CI roughly 1.96 * std / sqrt(n)
    const margin = 1.96 * std / Math.sqrt(foldROIs.length);
    
    return {
      meanROI: mean,
      stdROI: std,
      minROI: min,
      maxROI: max,
      ciROI: [mean - margin, mean + margin]
    };
  }
}
