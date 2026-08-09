/**
 * Phase 2b calibration research metrics.
 * Primary: LogLoss, Brier, ECE, calibration slope, calibration intercept.
 * Secondary: reliability table, probability bucket analysis, fold stability.
 */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

export type CalibrationStatus = 'CALIBRATED' | 'OVERCENT' | 'UNDERCENT' | 'UNCLEAR' | 'INSUFFICIENT_SAMPLE';

export interface BinaryEval {
  n: number;
  brier: number;
  logloss: number;
  ece: number;        // Phase 2a-compatible ECE (50%+ buckets)
  slope: number;
  intercept: number;
  calibration_status: CalibrationStatus;
}

export interface MulticlassEval {
  n: number;
  brier: number;
  logloss: number;
  ece: number;
  slope: number;
  intercept: number;
  calibration_status: CalibrationStatus;
}

/** Phase 2a-compatible ECE: 50-55 ... 80+ buckets (matches lock baseline definition). */
export function ecePhase2ABucket(probs: number[], outcomes: boolean[]): number {
  const ranges = [
    { lo: 0.5, hi: 0.55 },
    { lo: 0.55, hi: 0.6 },
    { lo: 0.6, hi: 0.65 },
    { lo: 0.65, hi: 0.7 },
    { lo: 0.7, hi: 0.75 },
    { lo: 0.75, hi: 0.8 },
    { lo: 0.8, hi: 1.0001 },
  ];
  let ece = 0;
  let totalN = 0;
  for (const r of ranges) {
    const items: number[] = [];
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] >= r.lo && probs[i] < r.hi) items.push(i);
    }
    if (items.length === 0) continue;
    const predicted = mean(items.map((i) => probs[i]));
    const actual = mean(items.map((i) => (outcomes[i] ? 1 : 0)));
    ece += Math.abs(predicted - actual) * items.length;
    totalN += items.length;
  }
  return totalN > 0 ? Number((ece / totalN).toFixed(5)) : 0;
}

/** Standard 10-bin ECE. */
export function ece10(probs: number[], y: number[]): number {
  let ece = 0;
  const total = probs.length;
  if (total === 0) return 0;
  for (let b = 0; b < 10; b++) {
    const lo = b / 10;
    const hi = (b + 1) / 10;
    const idx: number[] = [];
    for (let i = 0; i < total; i++) {
      if (probs[i] >= lo && probs[i] < hi) idx.push(i);
    }
    if (idx.length === 0) continue;
    ece += (idx.length / total) * Math.abs(mean(idx.map((i) => probs[i])) - mean(idx.map((i) => y[i])));
  }
  return ece;
}

/**
 * Calibration slope/intercept: logistic recalibration of logit(y) ~ b0 + b1 * logit(p).
 * Iteratively reweighted least squares on standardized logit feature.
 * Ideal: slope=1, intercept=0.
 */
export function calibrationSlopeIntercept(probs: number[], y: number[]): { slope: number; intercept: number } {
  const n = probs.length;
  if (n < 30) return { slope: 1, intercept: 0 };
  const ep = 1e-6;
  const x = probs.map((p) => Math.log(clamp(p, ep, 1 - ep) / clamp(1 - p, ep, 1 - ep)));
  const yv = y.map((v) => (v > 0 ? 1 : 0));
  const xm = mean(x);
  const xsd = stdev(x) || 1;
  const xs = x.map((v) => (v - xm) / xsd);
  let b0 = 0;
  let b1 = 0;
  for (let iter = 0; iter < 50; iter++) {
    let grad0 = 0;
    let grad1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    for (let i = 0; i < n; i++) {
      const z = b0 + b1 * xs[i];
      const p = 1 / (1 + Math.exp(-z));
      const r = yv[i] - p;
      grad0 += r;
      grad1 += r * xs[i];
      const w = p * (1 - p);
      h00 += w;
      h01 += w * xs[i];
      h11 += w * xs[i] * xs[i];
    }
    const det = h00 * h11 - h01 * h01;
    if (det <= 0) break;
    const d0 = (h11 * grad0 - h01 * grad1) / det;
    const d1 = (-h01 * grad0 + h00 * grad1) / det;
    b0 += d0;
    b1 += d1;
    if (Math.abs(d0) < 1e-8 && Math.abs(d1) < 1e-8) break;
  }
  return { slope: b1 / xsd, intercept: b0 - (b1 / xsd) * xm };
}

function statusFor(slope: number, intercept: number, n: number): CalibrationStatus {
  if (n < 100) return 'INSUFFICIENT_SAMPLE';
  if (slope < 0.75) return 'OVERCENT';
  if (slope > 1.25 && intercept < -0.25) return 'OVERCENT';
  if (slope > 1.25 && intercept > 0.25) return 'UNDERCENT';
  if (Math.abs(slope - 1) < 0.25 && Math.abs(intercept) < 0.5) return 'CALIBRATED';
  return 'UNCLEAR';
}

export function evalBinary(probs: number[], outcomes: boolean[]): BinaryEval {
  const n = probs.length;
  if (n === 0) {
    return { n: 0, brier: 0, logloss: 0, ece: 0, slope: 1, intercept: 0, calibration_status: 'INSUFFICIENT_SAMPLE' };
  }
  const y = outcomes.map((o) => (o ? 1 : 0));
  let brier = 0;
  let logloss = 0;
  for (let i = 0; i < n; i++) {
    const p = clamp(probs[i], 1e-6, 1 - 1e-6);
    brier += (p - y[i]) ** 2;
    logloss += -(y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p));
  }
  const { slope, intercept } = calibrationSlopeIntercept(probs, y);
  return {
    n,
    brier: Number((brier / n).toFixed(5)),
    logloss: Number((logloss / n).toFixed(5)),
    ece: ecePhase2ABucket(probs, y.map((v) => v === 1)),
    slope: Number(slope.toFixed(4)),
    intercept: Number(intercept.toFixed(4)),
    calibration_status: statusFor(slope, intercept, n),
  };
}

export interface ReliabilityRow {
  bucket: string;
  n: number;
  predicted: number;
  actual: number;
  error: number;
}

/** Reliability table matching Phase 2a definition (50%+ buckets) for direct baseline comparison. */
export function reliabilityTablePhase2ABucket(probs: number[], outcomes: boolean[]): ReliabilityRow[] {
  const ranges = [
    { label: '50-55', lo: 0.5, hi: 0.55 },
    { label: '55-60', lo: 0.55, hi: 0.6 },
    { label: '60-65', lo: 0.6, hi: 0.65 },
    { label: '65-70', lo: 0.65, hi: 0.7 },
    { label: '70-75', lo: 0.7, hi: 0.75 },
    { label: '75-80', lo: 0.75, hi: 0.8 },
    { label: '80+', lo: 0.8, hi: 1.0001 },
  ];
  const rows: ReliabilityRow[] = [];
  for (const r of ranges) {
    const items: number[] = [];
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] >= r.lo && probs[i] < r.hi) items.push(i);
    }
    if (items.length === 0) {
      rows.push({ bucket: r.label, n: 0, predicted: 0, actual: 0, error: 0 });
      continue;
    }
    const predicted = mean(items.map((i) => probs[i]));
    const actual = mean(items.map((i) => (outcomes[i] ? 1 : 0)));
    rows.push({
      bucket: r.label,
      n: items.length,
      predicted: Number(predicted.toFixed(4)),
      actual: Number(actual.toFixed(4)),
      error: Number(Math.abs(predicted - actual).toFixed(4)),
    });
  }
  return rows;
}

export interface MultiDist {
  pHome: number;
  pDraw: number;
  pAway: number;
}

export function evalMulticlass(dists: MultiDist[], outcomes: Array<'H' | 'D' | 'A'>): MulticlassEval {
  const n = dists.length;
  if (n === 0) {
    return { n: 0, brier: 0, logloss: 0, ece: 0, slope: 1, intercept: 0, calibration_status: 'INSUFFICIENT_SAMPLE' };
  }
  let brier = 0;
  let logloss = 0;
  const selProbs: number[] = [];
  const selY: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = dists[i];
    const o = outcomes[i];
    const pHome = clamp(d.pHome, 1e-6, 1 - 1e-6);
    const pDraw = clamp(d.pDraw, 1e-6, 1 - 1e-6);
    const pAway = clamp(d.pAway, 1e-6, 1 - 1e-6);
    const yH = o === 'H' ? 1 : 0;
    const yD = o === 'D' ? 1 : 0;
    const yA = o === 'A' ? 1 : 0;
    brier += (pHome - yH) ** 2 + (pDraw - yD) ** 2 + (pAway - yA) ** 2;
    const pAssigned = o === 'H' ? pHome : o === 'D' ? pDraw : pAway;
    logloss += -Math.log(pAssigned);
    // Selection-level arrays (matches Phase 2a ECE definition over ML selections)
    selProbs.push(pHome, pDraw, pAway);
    selY.push(yH, yD, yA);
  }
  // Slope/intercept from selection-level (p, y): each of the 3 class indicators
  // is a binary calibration datapoint, matching the standard multiclass convention.
  const { slope, intercept } = calibrationSlopeIntercept(selProbs, selY);
  return {
    n,
    brier: Number((brier / n).toFixed(5)),
    logloss: Number((logloss / n).toFixed(5)),
    ece: ecePhase2ABucket(
      selProbs,
      selY.map((v) => v === 1)
    ),
    slope: Number(slope.toFixed(4)),
    intercept: Number(intercept.toFixed(4)),
    calibration_status: statusFor(slope, intercept, n * 3),
  };
}
