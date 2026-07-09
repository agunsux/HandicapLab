// HandicapLab Data Platform - Metrics Utilities
export class Metrics {
  public static logLoss(predictions: { probability: number; outcome: number }[]): number {
    let lossSum = 0;
    for (const p of predictions) {
      const prob = Math.max(0.0001, Math.min(0.9999, p.probability));
      lossSum += p.outcome === 1 ? -Math.log(prob) : -Math.log(1 - prob);
    }
    return predictions.length ? lossSum / predictions.length : 0;
  }

  public static brierScore(predictions: { probability: number; outcome: number }[]): number {
    let sum = 0;
    for (const p of predictions) {
      sum += Math.pow(p.probability - p.outcome, 2);
    }
    return predictions.length ? sum / predictions.length : 0;
  }

  public static classificationMetrics(predictions: { probability: number; outcome: number }[], threshold = 0.5) {
    let tp = 0, tn = 0, fp = 0, fn = 0;
    for (const p of predictions) {
      const predClass = p.probability >= threshold ? 1 : 0;
      if (predClass === 1 && p.outcome === 1) tp++;
      if (predClass === 0 && p.outcome === 0) tn++;
      if (predClass === 1 && p.outcome === 0) fp++;
      if (predClass === 0 && p.outcome === 1) fn++;
    }
    const accuracy = (tp + tn) / (tp + tn + fp + fn || 1);
    const precision = tp / (tp + fp || 1);
    const recall = tp / (tp + fn || 1);
    const f1 = (2 * precision * recall) / (precision + recall || 1);
    return { accuracy, precision, recall, f1, tp, tn, fp, fn };
  }

  public static rocAuc(predictions: { probability: number; outcome: number }[]): number {
    if (predictions.length === 0) return 0.5;
    const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
    let numPos = 0;
    let numNeg = 0;
    for (const p of sorted) {
      if (p.outcome === 1) numPos++;
      else numNeg++;
    }
    if (numPos === 0 || numNeg === 0) return 0.5; // undefined effectively

    let auc = 0;
    let currentPos = 0;
    let currentNeg = 0;
    let lastProb = -1;
    let tiedPos = 0;
    let tiedNeg = 0;

    for (const p of sorted) {
      if (p.probability !== lastProb) {
        auc += currentPos * tiedNeg + (tiedPos * tiedNeg) / 2;
        currentPos += tiedPos;
        currentNeg += tiedNeg;
        tiedPos = 0;
        tiedNeg = 0;
        lastProb = p.probability;
      }
      if (p.outcome === 1) tiedPos++;
      else tiedNeg++;
    }
    auc += currentPos * tiedNeg + (tiedPos * tiedNeg) / 2;
    return auc / (numPos * numNeg);
  }

  public static prAuc(predictions: { probability: number; outcome: number }[]): number {
    if (predictions.length === 0) return 0;
    const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
    const numPos = sorted.filter(p => p.outcome === 1).length;
    if (numPos === 0) return 0;

    let auc = 0;
    let tp = 0;
    let fp = 0;
    let prevRecall = 0;
    let prevPrecision = 1.0;

    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].outcome === 1) tp++;
      else fp++;

      // calculate only when probability changes to correctly handle ties, or at the end
      if (i === sorted.length - 1 || sorted[i].probability !== sorted[i+1].probability) {
        const recall = tp / numPos;
        const precision = tp / (tp + fp);
        
        // Trapezoidal integration
        auc += (recall - prevRecall) * (precision + prevPrecision) / 2;
        
        prevRecall = recall;
        prevPrecision = precision;
      }
    }
    return auc;
  }
}
