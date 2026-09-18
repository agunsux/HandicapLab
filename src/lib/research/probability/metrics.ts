// ============================================================================
// PROBABILITY EVALUATION METRICS (BRIER, LOG LOSS, ECE)
// ============================================================================
// Location: src/lib/research/probability/metrics.ts
//
// Computes probability quality metrics without reference to betting profitability:
//   - Multi-class Brier Score (1X2) & Binary Brier Score
//   - Multi-class Log-Loss & Binary Log-Loss
//   - Expected Calibration Error (ECE) across 10 reliability bins
// ============================================================================

export interface MultiClassEvaluationResult {
  sampleSize: number;
  brierScore: number;
  logLoss: number;
  ece: number; // Expected Calibration Error (10 bins)
}

export interface BinaryEvaluationResult {
  sampleSize: number;
  brierScore: number;
  logLoss: number;
  ece: number;
}

export class ProbabilityMetricsCalculator {
  /**
   * Evaluates 3-way 1X2 probabilities against actual match outcomes ('1' | 'X' | '2').
   */
  public static evaluate1X2(
    predictions: Array<{ pHome: number; pDraw: number; pAway: number; actual: '1' | 'X' | '2' }>
  ): MultiClassEvaluationResult {
    const n = predictions.length;
    if (n === 0) {
      return { sampleSize: 0, brierScore: 0, logLoss: 0, ece: 0 };
    }

    let brierSum = 0;
    let logLossSum = 0;
    const eps = 1e-12;

    for (const p of predictions) {
      const yH = p.actual === '1' ? 1 : 0;
      const yD = p.actual === 'X' ? 1 : 0;
      const yA = p.actual === '2' ? 1 : 0;

      // Multi-class Brier Score
      brierSum +=
        Math.pow(p.pHome - yH, 2) +
        Math.pow(p.pDraw - yD, 2) +
        Math.pow(p.pAway - yA, 2);

      // Multi-class Log-Loss
      logLossSum += -(
        yH * Math.log(Math.max(eps, p.pHome)) +
        yD * Math.log(Math.max(eps, p.pDraw)) +
        yA * Math.log(Math.max(eps, p.pAway))
      );
    }

    // 10-bin ECE for the highest confidence outcome
    const numBins = 10;
    const binCounts = new Array(numBins).fill(0);
    const binConfSum = new Array(numBins).fill(0);
    const binAccSum = new Array(numBins).fill(0);

    for (const p of predictions) {
      const maxP = Math.max(p.pHome, p.pDraw, p.pAway);
      let predictedOutcome: '1' | 'X' | '2' = '1';
      if (maxP === p.pDraw) predictedOutcome = 'X';
      else if (maxP === p.pAway) predictedOutcome = '2';

      const hit = predictedOutcome === p.actual ? 1 : 0;
      const binIdx = Math.min(numBins - 1, Math.floor(maxP * numBins));

      binCounts[binIdx]++;
      binConfSum[binIdx] += maxP;
      binAccSum[binIdx] += hit;
    }

    let ece = 0;
    for (let b = 0; b < numBins; b++) {
      if (binCounts[b] > 0) {
        const binConf = binConfSum[b] / binCounts[b];
        const binAcc = binAccSum[b] / binCounts[b];
        ece += (binCounts[b] / n) * Math.abs(binAcc - binConf);
      }
    }

    return {
      sampleSize: n,
      brierScore: Number((brierSum / n).toFixed(5)),
      logLoss: Number((logLossSum / n).toFixed(5)),
      ece: Number(ece.toFixed(5)),
    };
  }

  /**
   * Evaluates binary probabilities (e.g. BTTS Yes, Over 2.5) against actual binary outcomes (1 or 0).
   */
  public static evaluateBinary(
    predictions: Array<{ prob: number; actual: boolean }>
  ): BinaryEvaluationResult {
    const n = predictions.length;
    if (n === 0) {
      return { sampleSize: 0, brierScore: 0, logLoss: 0, ece: 0 };
    }

    let brierSum = 0;
    let logLossSum = 0;
    const eps = 1e-12;

    const numBins = 10;
    const binCounts = new Array(numBins).fill(0);
    const binConfSum = new Array(numBins).fill(0);
    const binAccSum = new Array(numBins).fill(0);

    for (const p of predictions) {
      const y = p.actual ? 1 : 0;
      const prob = Math.max(eps, Math.min(1 - eps, p.prob));

      brierSum += Math.pow(prob - y, 2);
      logLossSum += -(y * Math.log(prob) + (1 - y) * Math.log(1 - prob));

      const binIdx = Math.min(numBins - 1, Math.floor(prob * numBins));
      binCounts[binIdx]++;
      binConfSum[binIdx] += prob;
      binAccSum[binIdx] += y;
    }

    let ece = 0;
    for (let b = 0; b < numBins; b++) {
      if (binCounts[b] > 0) {
        const binConf = binConfSum[b] / binCounts[b];
        const binAcc = binAccSum[b] / binCounts[b];
        ece += (binCounts[b] / n) * Math.abs(binAcc - binConf);
      }
    }

    return {
      sampleSize: n,
      brierScore: Number((brierSum / n).toFixed(5)),
      logLoss: Number((logLossSum / n).toFixed(5)),
      ece: Number(ece.toFixed(5)),
    };
  }
}

