// HandicapLab Data Platform - Statistical Significance Testing
export class SignificanceTests {
  /**
   * Paired Bootstrap Hypothesis Testing
   * Tests if the difference in means between modelA and modelB is significant.
   * Null Hypothesis (H0): mean(A) - mean(B) = 0
   */
  public static pairedBootstrapTest(
    modelAPreds: number[], 
    modelBPreds: number[], 
    iterations = 1000, 
    randomSeed = 42
  ): { pValue: number, meanDiff: number } {
    if (modelAPreds.length !== modelBPreds.length || modelAPreds.length === 0) {
      throw new Error("Arrays must be of equal length and non-empty.");
    }

    const n = modelAPreds.length;
    let diffSum = 0;
    const diffs: number[] = [];
    for (let i = 0; i < n; i++) {
      const d = modelAPreds[i] - modelBPreds[i];
      diffs.push(d);
      diffSum += d;
    }
    const observedMeanDiff = diffSum / n;

    // Center diffs so the mean is 0 (assuming H0 is true)
    const centeredDiffs = diffs.map(d => d - observedMeanDiff);

    let seed = randomSeed;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    let extremeCount = 0;
    for (let i = 0; i < iterations; i++) {
      let sampleDiffSum = 0;
      for (let j = 0; j < n; j++) {
        const index = Math.floor(random() * n);
        sampleDiffSum += centeredDiffs[index];
      }
      const sampleMeanDiff = sampleDiffSum / n;
      if (Math.abs(sampleMeanDiff) >= Math.abs(observedMeanDiff)) {
        extremeCount++;
      }
    }

    return {
      pValue: extremeCount / iterations,
      meanDiff: observedMeanDiff
    };
  }

  /**
   * McNemar's Test for classification models
   * Uses continuity correction.
   */
  public static mcnemarTest(
    actual: number[], 
    modelAPreds: number[], 
    modelBPreds: number[]
  ): { chiSquared: number, pValue: number } {
    if (actual.length !== modelAPreds.length || actual.length !== modelBPreds.length) {
      throw new Error("Arrays must be of equal length.");
    }
    
    let aCorrectBIncorrect = 0; // b
    let aIncorrectBCorrect = 0; // c
    
    for (let i = 0; i < actual.length; i++) {
        const truth = actual[i];
        const aCorrect = (modelAPreds[i] >= 0.5 ? 1 : 0) === truth;
        const bCorrect = (modelBPreds[i] >= 0.5 ? 1 : 0) === truth;
        
        if (aCorrect && !bCorrect) aCorrectBIncorrect++;
        if (!aCorrect && bCorrect) aIncorrectBCorrect++;
    }

    const b = aCorrectBIncorrect;
    const c = aIncorrectBCorrect;
    
    if (b + c === 0) return { chiSquared: 0, pValue: 1.0 };

    const chiSquared = Math.pow(Math.abs(b - c) - 1, 2) / (b + c);
    
    // Approximation for p-value from chi-square (1 degree of freedom) using CDF
    // For exact p-value we would need a proper chi-sq CDF implementation.
    // Placeholder using a simple mapping for common thresholds.
    let pValue = 1.0;
    if (chiSquared > 10.828) pValue = 0.001;
    else if (chiSquared > 6.635) pValue = 0.01;
    else if (chiSquared > 3.841) pValue = 0.05;
    else if (chiSquared > 2.706) pValue = 0.10;

    return { chiSquared, pValue };
  }

  /**
   * Diebold-Mariano Test (simplified version for non-autocorrelated forecasts)
   */
  public static dieboldMarianoTest(
    actual: number[],
    modelAPreds: number[],
    modelBPreds: number[]
  ): { DM: number, pValue: number } {
    const n = actual.length;
    if (n === 0) return { DM: 0, pValue: 1.0 };
    
    const d: number[] = [];
    let sumD = 0;
    
    for (let i = 0; i < n; i++) {
        // Squared Error loss differential
        const errorA = Math.pow(modelAPreds[i] - actual[i], 2);
        const errorB = Math.pow(modelBPreds[i] - actual[i], 2);
        const diff = errorA - errorB;
        d.push(diff);
        sumD += diff;
    }
    
    const meanD = sumD / n;
    
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
        sumSq += Math.pow(d[i] - meanD, 2);
    }
    const varD = sumSq / (n - 1);
    
    if (varD === 0) return { DM: 0, pValue: 1.0 };
    
    const DM = meanD / Math.sqrt(varD / n);
    
    // Normal CDF approximation for two-tailed p-value
    const pValue = 2 * (1 - this.normalCDF(Math.abs(DM)));
    
    return { DM, pValue };
  }
  
  // Approximation of Normal CDF
  private static normalCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }
}
