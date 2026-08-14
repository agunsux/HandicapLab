export interface BinomialMetrics {
  n: number;
  mean: number;
  stdev: number;
  ci95_low: number;
  ci95_high: number;
}

export function winRateWithCI(wins: number, n: number): BinomialMetrics | null {
  if (n === 0) return null;
  const p = wins / n;
  const stdev = Math.sqrt((p * (1 - p)) / n);
  return {
    n,
    mean: p,
    stdev,
    ci95_low: Math.max(0, p - 1.96 * stdev),
    ci95_high: Math.min(1, p + 1.96 * stdev),
  };
}

export function roiWithCI(profits: number[], stakes: number[]): { roi: number; n: number; stdev: number; ci95_low: number; ci95_high: number } | null {
  const n = profits.length;
  if (n === 0) return null;
  const returns = profits.map((p, i) => p / stakes[i]);
  const mean = returns.reduce((s, v) => s + v, 0) / n;
  const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1 || 1);
  const stdev = Math.sqrt(variance);
  const se = stdev / Math.sqrt(n);
  return {
    roi: mean,
    n,
    stdev,
    ci95_low: mean - 1.96 * se,
    ci95_high: mean + 1.96 * se,
  };
}

export interface BrierResult {
  brier: number;
  logloss: number;
  n: number;
}

export function brierAndLogLoss(preds: Array<{ pHome: number; pDraw: number; pAway: number }>, outcomes: Array<'H' | 'D' | 'A'>): BrierResult | null {
  const n = preds.length;
  if (n === 0) return null;
  let brier = 0;
  let logloss = 0;
  for (let i = 0; i < n; i++) {
    const p = preds[i];
    const o = outcomes[i];
    const yHome = o === 'H' ? 1 : 0;
    const yDraw = o === 'D' ? 1 : 0;
    const yAway = o === 'A' ? 1 : 0;
    brier += (p.pHome - yHome) ** 2 + (p.pDraw - yDraw) ** 2 + (p.pAway - yAway) ** 2;
    const assigned = o === 'H' ? p.pHome : o === 'D' ? p.pDraw : p.pAway;
    logloss += -Math.log(Math.min(0.999999, Math.max(0.000001, assigned)));
  }
  return { brier: Number((brier / n).toFixed(5)), logloss: Number((logloss / n).toFixed(5)), n };
}

export interface CalibrationBucket {
  bucket: string;
  n: number;
  predicted: number;
  actual: number;
  error: number;
}

export interface EvBucketResult {
  bucket: string;
  n: number;
  win_rate: number | null;
  avg_ev: number | null;
  realized_roi: number | null;
  roi_ci95: [number, number] | null;
}

export interface EvBucketAnalysis {
  buckets: EvBucketResult[];
  statement: string;
}

export function evBucketAnalysis(
  picks: Array<{ ev: number; outcome: 'WIN' | 'LOSS' | 'PUSH' | null; profit: number | null }>
): EvBucketAnalysis {
  const ranges = [
    { label: '<0%', lo: -Infinity, hi: 0 },
    { label: '0-5%', lo: 0, hi: 0.05 },
    { label: '5-10%', lo: 0.05, hi: 0.1 },
    { label: '10-20%', lo: 0.1, hi: 0.2 },
    { label: '20-30%', lo: 0.2, hi: 0.3 },
    { label: '30%+', lo: 0.3, hi: Infinity },
  ];
  const buckets: EvBucketResult[] = [];
  let settledTotal = 0;
  for (const r of ranges) {
    const items = picks.filter((x) => x.ev >= r.lo && x.ev < r.hi);
    const n = items.length;
    const withProfit = items.filter((x) => x.profit !== null);
    settledTotal += withProfit.length;
    if (n === 0) {
      buckets.push({ bucket: r.label, n: 0, win_rate: null, avg_ev: null, realized_roi: null, roi_ci95: null });
      continue;
    }
    const wins = items.filter((x) => x.outcome === 'WIN').length;
    const avgEv = Number((items.reduce((s, x) => s + x.ev, 0) / n).toFixed(4));
    let realized: { roi: number; n: number; stdev: number; ci95_low: number; ci95_high: number } | null = null;
    if (withProfit.length > 0) {
      realized = roiWithCI(withProfit.map((x) => x.profit!), withProfit.map(() => 1));
    }
    buckets.push({
      bucket: r.label,
      n,
      win_rate: n > 0 ? Number((wins / n).toFixed(4)) : null,
      avg_ev: avgEv,
      realized_roi: realized ? Number(realized.roi.toFixed(4)) : null,
      roi_ci95: realized ? [Number(realized.ci95_low.toFixed(4)), Number(realized.ci95_high.toFixed(4))] : null,
    });
  }
  const statement = settledTotal < 200
    ? 'predictive value not yet established: insufficient settled sample'
    : 'preliminary: compare realized ROI vs average EV across buckets';
  return { buckets, statement };
}

export function calibrationBuckets(preds: Array<{ p: number; outcome: boolean }>): { buckets: CalibrationBucket[]; ece: number } {
  const ranges = [
    { label: '0-10', lo: 0.0, hi: 0.1 },
    { label: '10-20', lo: 0.1, hi: 0.2 },
    { label: '20-30', lo: 0.2, hi: 0.3 },
    { label: '30-40', lo: 0.3, hi: 0.4 },
    { label: '40-50', lo: 0.4, hi: 0.5 },
    { label: '50-55', lo: 0.5, hi: 0.55 },
    { label: '55-60', lo: 0.55, hi: 0.6 },
    { label: '60-65', lo: 0.6, hi: 0.65 },
    { label: '65-70', lo: 0.65, hi: 0.7 },
    { label: '70-75', lo: 0.7, hi: 0.75 },
    { label: '75-80', lo: 0.75, hi: 0.8 },
    { label: '80+', lo: 0.8, hi: 1.0001 },
  ];
  const buckets: CalibrationBucket[] = [];
  let ece = 0;
  let totalN = 0;
  for (const r of ranges) {
    const items = preds.filter((x) => x.p >= r.lo && (r.label === '80+' ? x.p <= r.hi : x.p < r.hi));
    const n = items.length;
    if (n === 0) {
      buckets.push({ bucket: r.label, n: 0, predicted: 0, actual: 0, error: 0 });
      continue;
    }
    const predicted = items.reduce((s, x) => s + x.p, 0) / n;
    const actual = items.filter((x) => x.outcome).length / n;
    const error = Math.abs(predicted - actual);
    buckets.push({ bucket: r.label, n, predicted: Number(predicted.toFixed(4)), actual: Number(actual.toFixed(4)), error: Number(error.toFixed(4)) });
    ece += error * n;
    totalN += n;
  }
  return { buckets, ece: totalN > 0 ? Number((ece / totalN).toFixed(5)) : 0 };
}
