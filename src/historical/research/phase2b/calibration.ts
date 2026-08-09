import { fitBinaryTemperature, fitSoftmaxTemperature, applyBinaryTemperature, applySoftmaxTemperature } from '../../model/calibrate';

/**
 * Phase 2b calibration research — candidate methods:
 *   1. Temperature scaling (reused from Phase 2a, kept as a candidate)
 *   2. Probability shrinkage toward empirical base rate
 *   3. Isotonic regression (PAV), one-vs-all for multiclass
 *
 * All calibrators are fit ONLY on data available before the test fold.
 * No test-fold outcome ever enters a fit.
 */

const EPS = 1e-7;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function round3(v: number): number {
  return Number(v.toFixed(3));
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length;
}

function loglossArray(probs: number[], outcomes: boolean[]): number {
  let ll = 0;
  for (let i = 0; i < probs.length; i++) {
    const pc = clamp(probs[i], EPS, 1 - EPS);
    ll += -Math.log(outcomes[i] ? pc : 1 - pc);
  }
  return ll / Math.max(1, probs.length);
}

export interface BinaryCalibrationFit {
  method: 'temperature' | 'shrinkage' | 'isotonic';
  fitted_on: string[];
  n_train: number;
  train_logloss: number;
  temperature?: number;
  alpha?: number;
  base_rate?: number;
  isotonic_x?: number[];
  isotonic_y?: number[];
  at_boundary?: boolean;
}

export interface MulticlassCalibrationFit {
  method: 'temperature' | 'shrinkage' | 'isotonic';
  fitted_on: string[];
  n_train: number;
  train_logloss: number;
  temperature?: number;
  alpha?: number;
  base_rates?: [number, number, number];
  isotonic_per_class?: Array<{ x: number[]; y: number[] }>;
  at_boundary?: boolean;
}

// ---------------------------------------------------------------------------
// Shrinkage (binary)
// ---------------------------------------------------------------------------

export function fitShrinkageBinary(
  probs: number[],
  outcomes: boolean[],
  fittedOn: string[],
  alphaMin = 0,
  alphaMax = 1,
  step = 0.01
): BinaryCalibrationFit {
  const baseRate = outcomes.length > 0 ? outcomes.filter(Boolean).length / outcomes.length : 0.5;
  let bestAlpha = 1;
  let bestLl = Infinity;
  for (let a = alphaMin; a <= alphaMax + 1e-9; a += step) {
    const cal = probs.map((p) => clamp(a * p + (1 - a) * baseRate, EPS, 1 - EPS));
    const ll = loglossArray(cal, outcomes);
    if (ll < bestLl) {
      bestLl = ll;
      bestAlpha = a;
    }
  }
  return {
    method: 'shrinkage',
    fitted_on: fittedOn,
    n_train: probs.length,
    train_logloss: round3(bestLl),
    alpha: round3(bestAlpha),
    base_rate: round3(baseRate),
  };
}

export function applyShrinkageBinary(p: number, alpha: number, baseRate: number): number {
  return clamp(alpha * p + (1 - alpha) * baseRate, EPS, 1 - EPS);
}

// ---------------------------------------------------------------------------
// Isotonic regression (PAV) — binary
// ---------------------------------------------------------------------------

interface PAVBlock {
  value: number;
  weight: number;
  size: number;
}

/** Pool Adjacent Violators — returns fitted values in the same order as input y. */
export function pavFitted(y: number[], weights: number[]): number[] {
  const n = y.length;
  if (n === 0) return [];
  const blocks: PAVBlock[] = [];
  for (let i = 0; i < n; i++) {
    blocks.push({ value: y[i], weight: weights[i], size: 1 });
    while (blocks.length >= 2) {
      const b1 = blocks[blocks.length - 2];
      const b2 = blocks[blocks.length - 1];
      if (b1.value <= b2.value + 1e-12) break;
      const w = b1.weight + b2.weight;
      const v = w > 0 ? (b1.value * b1.weight + b2.value * b2.weight) / w : b1.value;
      blocks.pop();
      blocks.pop();
      blocks.push({ value: v, weight: w, size: b1.size + b2.size });
    }
  }
  const out: number[] = [];
  for (const b of blocks) {
    for (let i = 0; i < b.size; i++) out.push(b.value);
  }
  return out;
}

export function fitIsotonicBinary(
  probs: number[],
  outcomes: boolean[],
  fittedOn: string[],
  minSample = 500
): BinaryCalibrationFit {
  if (probs.length < minSample) {
    // Insufficient sample: status = INSUFFICIENT_SAMPLE; fall back to base rate.
    const base = mean(outcomes.map((o) => (o ? 1 : 0)));
    return {
      method: 'isotonic',
      fitted_on: fittedOn,
      n_train: probs.length,
      train_logloss: loglossArray(probs, outcomes),
      isotonic_x: [0, 1],
      isotonic_y: [base, base],
      at_boundary: false,
    };
  }
  const pairs = probs
    .map((p, i) => ({ p, y: outcomes[i] ? 1 : 0 }))
    .sort((a, b) => a.p - b.p);
  const fitted = pavFitted(pairs.map((x) => x.y), pairs.map(() => 1));
  const trainLl = mean(fitted.map((f, i) => -Math.log(clamp(pairs[i].y === 1 ? f : 1 - f, EPS, 1 - EPS))));
  return {
    method: 'isotonic',
    fitted_on: fittedOn,
    n_train: probs.length,
    train_logloss: round3(trainLl),
    isotonic_x: pairs.map((x) => x.p),
    isotonic_y: fitted,
    at_boundary: false,
  };
}

export function applyIsotonicBinary(p: number, fit: BinaryCalibrationFit): number {
  const xs = fit.isotonic_x!;
  const ys = fit.isotonic_y!;
  if (xs.length === 0 || ys.length === 0) return clamp(p, EPS, 1 - EPS);
  if (p <= xs[0]) return clamp(ys[0], EPS, 1 - EPS);
  if (p >= xs[xs.length - 1]) return clamp(ys[ys.length - 1], EPS, 1 - EPS);
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= p) lo = mid;
    else hi = mid;
  }
  const span = xs[hi] - xs[lo];
  const t = span > 0 ? (p - xs[lo]) / span : 0;
  return clamp(ys[lo] + t * (ys[hi] - ys[lo]), EPS, 1 - EPS);
}

// ---------------------------------------------------------------------------
// Multiclass (ML: home/draw/away)
// ---------------------------------------------------------------------------

export interface MultiDist {
  pHome: number;
  pDraw: number;
  pAway: number;
}

function freqOf(outcomes: Array<'H' | 'D' | 'A'>, c: 'H' | 'D' | 'A'): number {
  const n = outcomes.length;
  return n === 0 ? 1 / 3 : outcomes.filter((o) => o === c).length / n;
}

function multiAssigned(d: MultiDist, o: 'H' | 'D' | 'A'): number {
  return o === 'H' ? d.pHome : o === 'D' ? d.pDraw : d.pAway;
}

function multiLogloss(dists: MultiDist[], outcomes: Array<'H' | 'D' | 'A'>): number {
  let ll = 0;
  for (let i = 0; i < dists.length; i++) {
    ll += -Math.log(clamp(multiAssigned(dists[i], outcomes[i]), EPS, 1 - EPS));
  }
  return ll / Math.max(1, dists.length);
}

function normalize(d: MultiDist): MultiDist {
  const s = d.pHome + d.pDraw + d.pAway;
  if (s <= 0) return { pHome: 1 / 3, pDraw: 1 / 3, pAway: 1 / 3 };
  return {
    pHome: clamp(d.pHome / s, EPS, 1 - EPS),
    pDraw: clamp(d.pDraw / s, EPS, 1 - EPS),
    pAway: clamp(d.pAway / s, EPS, 1 - EPS),
  };
}

export function fitShrinkageMulticlass(
  dists: MultiDist[],
  outcomes: Array<'H' | 'D' | 'A'>,
  fittedOn: string[],
  alphaMin = 0,
  alphaMax = 1,
  step = 0.01
): MulticlassCalibrationFit {
  const baseRates: [number, number, number] = [
    freqOf(outcomes, 'H'),
    freqOf(outcomes, 'D'),
    freqOf(outcomes, 'A'),
  ];
  let bestAlpha = 1;
  let bestLl = Infinity;
  for (let a = alphaMin; a <= alphaMax + 1e-9; a += step) {
    const cal = dists.map((d) =>
      normalize({
        pHome: a * d.pHome + (1 - a) * baseRates[0],
        pDraw: a * d.pDraw + (1 - a) * baseRates[1],
        pAway: a * d.pAway + (1 - a) * baseRates[2],
      })
    );
    const ll = multiLogloss(cal, outcomes);
    if (ll < bestLl) {
      bestLl = ll;
      bestAlpha = a;
    }
  }
  return {
    method: 'shrinkage',
    fitted_on: fittedOn,
    n_train: dists.length,
    train_logloss: round3(bestLl),
    alpha: round3(bestAlpha),
    base_rates: baseRates.map(round3) as [number, number, number],
  };
}

export function applyShrinkageMulticlass(
  d: MultiDist,
  alpha: number,
  baseRates: [number, number, number]
): MultiDist {
  return normalize({
    pHome: alpha * d.pHome + (1 - alpha) * baseRates[0],
    pDraw: alpha * d.pDraw + (1 - alpha) * baseRates[1],
    pAway: alpha * d.pAway + (1 - alpha) * baseRates[2],
  });
}

function interpolate(p: number, xs: number[], ys: number[]): number {
  if (p <= xs[0]) return clamp(ys[0], EPS, 1 - EPS);
  if (p >= xs[xs.length - 1]) return clamp(ys[ys.length - 1], EPS, 1 - EPS);
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= p) lo = mid;
    else hi = mid;
  }
  const span = xs[hi] - xs[lo];
  const t = span > 0 ? (p - xs[lo]) / span : 0;
  return clamp(ys[lo] + t * (ys[hi] - ys[lo]), EPS, 1 - EPS);
}

export function fitIsotonicMulticlass(
  dists: MultiDist[],
  outcomes: Array<'H' | 'D' | 'A'>,
  fittedOn: string[],
  minSample = 500
): MulticlassCalibrationFit {
  const classes: Array<'H' | 'D' | 'A'> = ['H', 'D', 'A'];
  const perClass = classes.map((c) => {
    const p = dists.map((d) => (c === 'H' ? d.pHome : c === 'D' ? d.pDraw : d.pAway));
    const y = outcomes.map((o) => (o === c ? 1 : 0));
    if (p.length < minSample) {
      const base = mean(y);
      return { x: [0, 1], y: [base, base] };
    }
    const pairs = p.map((v, i) => ({ v, y: y[i] })).sort((a, b) => a.v - b.v);
    const fitted = pavFitted(pairs.map((x) => x.y), pairs.map(() => 1));
    return { x: pairs.map((x) => x.v), y: fitted };
  });
  const cal = dists.map((d) =>
    normalize({
      pHome: interpolate(d.pHome, perClass[0].x, perClass[0].y),
      pDraw: interpolate(d.pDraw, perClass[1].x, perClass[1].y),
      pAway: interpolate(d.pAway, perClass[2].x, perClass[2].y),
    })
  );
  return {
    method: 'isotonic',
    fitted_on: fittedOn,
    n_train: dists.length,
    train_logloss: round3(multiLogloss(cal, outcomes)),
    isotonic_per_class: perClass,
    at_boundary: false,
  };
}

export function applyIsotonicMulticlass(d: MultiDist, fit: MulticlassCalibrationFit): MultiDist {
  const pc = fit.isotonic_per_class!;
  return normalize({
    pHome: interpolate(d.pHome, pc[0].x, pc[0].y),
    pDraw: interpolate(d.pDraw, pc[1].x, pc[1].y),
    pAway: interpolate(d.pAway, pc[2].x, pc[2].y),
  });
}

// ---------------------------------------------------------------------------
// Temperature wrappers (delegating to Phase 2a implementation)
// ---------------------------------------------------------------------------

export { fitBinaryTemperature, fitSoftmaxTemperature, applyBinaryTemperature, applySoftmaxTemperature };
