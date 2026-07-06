// HandicapLab Live Data Platform - Calibration Engine
// Location: src/lib/data-platform/calibration.ts

export interface PredictionResult {
  probability: number; // predicted probability (0-1)
  outcome: number; // actual outcome (1 = win/true, 0 = loss/false)
}

export interface BinStats {
  binIndex: number;
  minProb: number;
  maxProb: number;
  avgProbability: number;
  avgOutcome: number;
  count: number;
}

export class CalibrationEngine {
  /**
   * Computes the Expected Calibration Error (ECE).
   */
  public static calculateECE(predictions: PredictionResult[], binsCount = 10): number {
    if (predictions.length === 0) return 0;
    let ece = 0;
    const n = predictions.length;

    for (let b = 0; b < binsCount; b++) {
      const minP = b / binsCount;
      const maxP = (b + 1) / binsCount;
      const binPreds = predictions.filter((p) => p.probability >= minP && p.probability < maxP);

      if (binPreds.length > 0) {
        const avgConfidence = binPreds.reduce((sum, p) => sum + p.probability, 0) / binPreds.length;
        const actualWinRate = binPreds.reduce((sum, p) => sum + p.outcome, 0) / binPreds.length;
        const binWeight = binPreds.length / n;
        ece += binWeight * Math.abs(avgConfidence - actualWinRate);
      }
    }
    return ece;
  }

  /**
   * Computes the Maximum Calibration Error (MCE).
   */
  public static calculateMCE(predictions: PredictionResult[], binsCount = 10): number {
    if (predictions.length === 0) return 0;
    let mce = 0;

    for (let b = 0; b < binsCount; b++) {
      const minP = b / binsCount;
      const maxP = (b + 1) / binsCount;
      const binPreds = predictions.filter((p) => p.probability >= minP && p.probability < maxP);

      if (binPreds.length > 0) {
        const avgConfidence = binPreds.reduce((sum, p) => sum + p.probability, 0) / binPreds.length;
        const actualWinRate = binPreds.reduce((sum, p) => sum + p.outcome, 0) / binPreds.length;
        const error = Math.abs(avgConfidence - actualWinRate);
        if (error > mce) {
          mce = error;
        }
      }
    }
    return mce;
  }

  /**
   * Generates a Reliability Diagram/Curve statistics.
   */
  public static generateReliabilityCurve(predictions: PredictionResult[], binsCount = 10): BinStats[] {
    const bins: BinStats[] = [];

    for (let b = 0; b < binsCount; b++) {
      const minP = b / binsCount;
      const maxP = (b + 1) / binsCount;
      const binPreds = predictions.filter((p) => p.probability >= minP && p.probability < maxP);

      if (binPreds.length > 0) {
        const avgProbability = binPreds.reduce((sum, p) => sum + p.probability, 0) / binPreds.length;
        const avgOutcome = binPreds.reduce((sum, p) => sum + p.outcome, 0) / binPreds.length;
        bins.push({
          binIndex: b,
          minProb: minP,
          maxProb: maxP,
          avgProbability: Number(avgProbability.toFixed(4)),
          avgOutcome: Number(avgOutcome.toFixed(4)),
          count: binPreds.length
        });
      } else {
        bins.push({
          binIndex: b,
          minProb: minP,
          maxProb: maxP,
          avgProbability: 0,
          avgOutcome: 0,
          count: 0
        });
      }
    }
    return bins;
  }

  /**
   * Fits Platt Scaling parameters (A & B) using gradient descent or grid search.
   */
  public static fitPlattScaling(predictions: PredictionResult[]): { A: number; B: number } {
    let bestA = 1.0;
    let bestB = 0.0;
    let minLoss = Infinity;

    const logLoss = (prob: number, outcome: number): number => {
      const p = Math.max(0.0001, Math.min(0.9999, prob));
      return outcome === 1 ? -Math.log(p) : -Math.log(1 - p);
    };

    // Grid search over standard bounds
    for (let a = 0.5; a <= 2.0; a += 0.05) {
      for (let b = -0.5; b <= 0.5; b += 0.05) {
        let lossSum = 0;
        for (const p of predictions) {
          const clampedProb = Math.max(0.0001, Math.min(0.9999, p.probability));
          const logit = Math.log(clampedProb / (1 - clampedProb));
          const calibrated = 1 / (1 + Math.exp(-(a * logit + b)));
          lossSum += logLoss(calibrated, p.outcome);
        }
        if (lossSum < minLoss) {
          minLoss = lossSum;
          bestA = a;
          bestB = b;
        }
      }
    }

    return { A: bestA, B: bestB };
  }

  /**
   * Fits Isotonic Regression model using Pair-Adjacent Violators Algorithm (PAVA).
   * Returns a function to predict calibrated probabilities.
   */
  public static fitIsotonicRegression(predictions: PredictionResult[]): (p: number) => number {
    const n = predictions.length;
    if (n === 0) return (p: number) => p;

    // Map and sort predictions
    const data = predictions.map((x) => ({ p: x.probability, y: x.outcome }));
    data.sort((a, b) => a.p - b.p);

    const pools = data.map((d) => ({
      sumY: d.y,
      count: 1,
      pVal: d.p,
      yVal: d.y
    }));

    let active = true;
    while (active) {
      active = false;
      for (let i = 0; i < pools.length - 1; i++) {
        if (pools[i].yVal > pools[i + 1].yVal) {
          pools[i].sumY += pools[i + 1].sumY;
          pools[i].count += pools[i + 1].count;
          pools[i].yVal = pools[i].sumY / pools[i].count;
          pools.splice(i + 1, 1);
          active = true;
          break;
        }
      }
    }

    return (p: number) => {
      if (p <= pools[0].pVal) return pools[0].yVal;
      if (p >= pools[pools.length - 1].pVal) return pools[pools.length - 1].yVal;
      for (let i = 0; i < pools.length - 1; i++) {
        const p1 = pools[i].pVal;
        const p2 = pools[i + 1].pVal;
        if (p >= p1 && p <= p2) {
          const y1 = pools[i].yVal;
          const y2 = pools[i + 1].yVal;
          if (p2 === p1) return y1;
          return y1 + ((p - p1) * (y2 - y1)) / (p2 - p1);
        }
      }
      return p;
    };
  }

  /**
   * Renders an ASCII text-based reliability diagram table representation.
   */
  public static renderAsciiReliabilityDiagram(bins: BinStats[]): string {
    let result = '';
    result += `Bin Index | Probability Range | Avg Confidence | Empirical Accuracy | Count\n`;
    result += `----------|-------------------|----------------|--------------------|------\n`;
    bins.forEach((b) => {
      const range = `[${b.minProb.toFixed(1)} - ${b.maxProb.toFixed(1)}]`;
      result += `${String(b.binIndex).padEnd(9)} | ${range.padEnd(17)} | ${(b.avgProbability * 100).toFixed(1).padStart(5)}%       | ${(b.avgOutcome * 100).toFixed(1).padStart(5)}%            | ${b.count}\n`;
    });
    return result;
  }
}
