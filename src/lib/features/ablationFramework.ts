export interface AblationMetrics {
  accuracy1x2: number;
  accuracyAh: number;
  accuracyOu: number;
  brierScore1x2: number;     // Multi-class Brier score for Moneyline
  brierScoreAh: number;      // Binary Brier score for Asian Handicap cover
  brierScoreOu: number;      // Binary Brier score for Over/Under goals
  overallBrierScore: number;
  roi: number;               // Expected Yield percentage
  sampleSize: number;
}

/**
 * Calculates Brier score for binary predictions (AH, O/U).
 * BS = (1/N) * sum((prob - actual)^2)
 */
export function calculateBinaryBrierScore(probs: number[], outcomes: (0 | 1)[]): number {
  if (probs.length === 0 || probs.length !== outcomes.length) return 0;
  const sum = probs.reduce((acc, p, idx) => acc + Math.pow(p - outcomes[idx], 2), 0);
  return Number((sum / probs.length).toFixed(4));
}

/**
 * Calculates multi-class Brier score for 1X2 Moneyline predictions.
 * BS = (1/N) * sum(sum((prob_c - actual_c)^2))
 */
export function calculateMultiClassBrierScore(
  probs: [number, number, number][], // [homeProb, drawProb, awayProb]
  outcomes: ('home' | 'draw' | 'away')[]
): number {
  if (probs.length === 0 || probs.length !== outcomes.length) return 0;
  
  let totalError = 0;
  for (let i = 0; i < probs.length; i++) {
    const [pHome, pDraw, pAway] = probs[i];
    const actual = outcomes[i];
    
    const yHome = actual === 'home' ? 1 : 0;
    const yDraw = actual === 'draw' ? 1 : 0;
    const yAway = actual === 'away' ? 1 : 0;
    
    totalError += Math.pow(pHome - yHome, 2) + Math.pow(pDraw - yDraw, 2) + Math.pow(pAway - yAway, 2);
  }
  
  return Number((totalError / probs.length).toFixed(4));
}

/**
 * Calculates model calibration error by binning predictions and comparing average confidence to actual hit rate.
 */
export function calculateCalibrationCurve(
  probs: number[],
  outcomes: (0 | 1)[],
  binsCount = 5
): { binMidpoint: number; actualHitRate: number; sampleSize: number }[] {
  const bins = Array.from({ length: binsCount }, (_, i) => ({
    min: i / binsCount,
    max: (i + 1) / binsCount,
    sumProbs: 0,
    hits: 0,
    count: 0
  }));

  for (let i = 0; i < probs.length; i++) {
    const p = probs[i];
    const y = outcomes[i];
    const bin = bins.find(b => p >= b.min && p <= b.max) || bins[binsCount - 1];
    
    bin.sumProbs += p;
    bin.hits += y;
    bin.count++;
  }

  return bins.map(b => ({
    binMidpoint: Number(((b.min + b.max) / 2).toFixed(2)),
    actualHitRate: b.count > 0 ? Number(((b.hits / b.count) * 100).toFixed(2)) : 0,
    sampleSize: b.count
  }));
}

/**
 * Runs a side-by-side comparison table between two models.
 */
export function printAblationReport(
  baselineName: string, 
  baseline: AblationMetrics,
  candidateName: string, 
  candidate: AblationMetrics
) {
  console.log(`\n📊 FEATURE ABLATION REPORT`);
  console.log(`========================================================================`);
  console.log(
    String('Metric').padEnd(25) + ' | ' + 
    baselineName.padEnd(20) + ' | ' + 
    candidateName.padEnd(20) + ' | ' + 
    'Delta'
  );
  console.log('-'.repeat(25) + ' + ' + '-'.repeat(20) + ' + ' + '-'.repeat(20) + ' + ' + '-'.repeat(8));

  const compare = (label: string, baseVal: number, candVal: number, suffix = '', higherIsBetter = true) => {
    const diff = candVal - baseVal;
    const sign = diff >= 0 ? '+' : '';
    const isImproved = higherIsBetter ? diff >= 0 : diff <= 0;
    const deltaColor = isImproved ? '🟢' : '🔴';
    console.log(
      label.padEnd(25) + ' | ' + 
      (baseVal.toFixed(2) + suffix).padEnd(20) + ' | ' + 
      (candVal.toFixed(2) + suffix).padEnd(20) + ' | ' + 
      `${deltaColor} ${sign}${diff.toFixed(2)}${suffix}`
    );
  };

  compare('Accuracy 1X2', baseline.accuracy1x2, candidate.accuracy1x2, '%');
  compare('Accuracy AH', baseline.accuracyAh, candidate.accuracyAh, '%');
  compare('Accuracy O/U', baseline.accuracyOu, candidate.accuracyOu, '%');
  compare('Brier Score 1X2', baseline.brierScore1x2, candidate.brierScore1x2, '', false);
  compare('Brier Score AH', baseline.brierScoreAh, candidate.brierScoreAh, '', false);
  compare('Brier Score O/U', baseline.brierScoreOu, candidate.brierScoreOu, '', false);
  compare('Overall Brier Score', baseline.overallBrierScore, baseline.overallBrierScore, '', false);
  compare('Flat Yield / ROI', baseline.roi, candidate.roi, '%');
  console.log(`------------------------------------------------------------------------`);
  console.log(`Evaluation Sample Size: ${baseline.sampleSize} predictions`);
  console.log(`========================================================================\n`);
}
