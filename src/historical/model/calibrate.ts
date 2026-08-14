export interface TemperatureFit {
  method: 'temperature-scaling';
  T: number;
  fitted_on: string[];
  n_train: number;
  train_logloss: number;
  at_boundary: boolean;
  original_range: [number, number];
  calibrated_range: [number, number];
}

export interface PlattFit {
  method: 'platt-scaling';
  a: number;
  b: number;
  fitted_on: string[];
  n_train: number;
  train_logloss: number;
  original_range: [number, number];
  calibrated_range: [number, number];
}

const EPS = 1e-7;

function clampProb(p: number): number {
  if (isNaN(p) || !isFinite(p)) return 0.5;
  return Math.min(1 - EPS, Math.max(EPS, p));
}

function logit(p: number): number {
  const pc = clampProb(p);
  return Math.log(pc / (1 - pc));
}

function sigmoid(z: number): number {
  if (z > 35) return 1 - EPS;
  if (z < -35) return EPS;
  return 1 / (1 + Math.exp(-z));
}

function binaryCalibrated(p: number, T: number): number {
  const safeT = Math.max(0.01, T);
  const z = logit(p) / safeT;
  return sigmoid(z);
}

function softmaxCalibrated(dist: number[], T: number): number[] {
  const safeT = Math.max(0.01, T);
  const smoothed = dist.map(clampProb);
  const logits = smoothed.map((p) => Math.log(p) / safeT);
  const maxL = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxL));
  const sum = exps.reduce((s, v) => s + v, 0);
  if (sum <= 0) {
    const uniform = 1 / dist.length;
    return dist.map(() => uniform);
  }
  return exps.map((v) => v / sum);
}

export function fitBinaryTemperature(
  probs: number[],
  outcomes: boolean[],
  fittedOn: string[],
  tMin = 0.2,
  tMax = 5.0,
  step = 0.05
): TemperatureFit {
  let bestT = 1.0;
  let bestNll = Infinity;
  let originalRange: [number, number] = [1, 0];
  let calibratedRange: [number, number] = [1, 0];

  if (probs.length > 0) {
    originalRange = [Math.min(...probs), Math.max(...probs)];
  }

  for (let t = tMin; t <= tMax + 1e-9; t += step) {
    let nll = 0;
    let calMin = 1, calMax = 0;
    for (let i = 0; i < probs.length; i++) {
      const pc = binaryCalibrated(probs[i], t);
      calMin = Math.min(calMin, pc);
      calMax = Math.max(calMax, pc);
      nll += -(outcomes[i] ? Math.log(pc) : Math.log(1 - pc));
    }
    if (nll < bestNll) {
      bestNll = nll;
      bestT = t;
      calibratedRange = [calMin, calMax];
    }
  }

  const atBoundary = bestT <= tMin + step || bestT >= tMax - step;

  return {
    method: 'temperature-scaling',
    T: Number(bestT.toFixed(3)),
    fitted_on: fittedOn,
    n_train: probs.length,
    train_logloss: Number((bestNll / Math.max(1, probs.length)).toFixed(5)),
    at_boundary: atBoundary,
    original_range: originalRange,
    calibrated_range: calibratedRange,
  };
}

export function fitBinaryPlatt(
  probs: number[],
  outcomes: boolean[],
  fittedOn: string[],
  aMin = 0.1,
  aMax = 2.0,
  aStep = 0.05,
  bMin = -0.6,
  bMax = 0.6,
  bStep = 0.05
): PlattFit {
  let bestA = 1.0;
  let bestB = 0.0;
  let bestNll = Infinity;
  let originalRange: [number, number] = [1, 0];
  let calibratedRange: [number, number] = [1, 0];

  if (probs.length > 0) {
    originalRange = [Math.min(...probs), Math.max(...probs)];
  }

  for (let a = aMin; a <= aMax + 1e-9; a += aStep) {
    for (let b = bMin; b <= bMax + 1e-9; b += bStep) {
      let nll = 0;
      let calMin = 1, calMax = 0;
      for (let i = 0; i < probs.length; i++) {
        const z = a * logit(probs[i]) + b;
        const pc = sigmoid(z);
        calMin = Math.min(calMin, pc);
        calMax = Math.max(calMax, pc);
        nll += -(outcomes[i] ? Math.log(pc) : Math.log(1 - pc));
      }
      if (nll < bestNll) {
        bestNll = nll;
        bestA = a;
        bestB = b;
        calibratedRange = [calMin, calMax];
      }
    }
  }

  return {
    method: 'platt-scaling',
    a: Number(bestA.toFixed(3)),
    b: Number(bestB.toFixed(3)),
    fitted_on: fittedOn,
    n_train: probs.length,
    train_logloss: Number((bestNll / Math.max(1, probs.length)).toFixed(5)),
    original_range: originalRange,
    calibrated_range: calibratedRange,
  };
}

export function fitSoftmaxTemperature(
  dists: Array<{ pHome: number; pDraw: number; pAway: number }>,
  outcomes: Array<'H' | 'D' | 'A'>,
  fittedOn: string[],
  tMin = 0.2,
  tMax = 5.0,
  step = 0.05
): TemperatureFit {
  let bestT = 1.0;
  let bestNll = Infinity;
  let originalRange: [number, number] = [1, 0];
  let calibratedRange: [number, number] = [1, 0];

  if (dists.length > 0) {
    const allProbs = dists.flatMap((d) => [d.pHome, d.pDraw, d.pAway]);
    originalRange = [Math.min(...allProbs), Math.max(...allProbs)];
  }

  for (let t = tMin; t <= tMax + 1e-9; t += step) {
    let nll = 0;
    let calMin = 1, calMax = 0;
    for (let i = 0; i < dists.length; i++) {
      const cal = softmaxCalibrated([dists[i].pHome, dists[i].pDraw, dists[i].pAway], t);
      const assigned = outcomes[i] === 'H' ? cal[0] : outcomes[i] === 'D' ? cal[1] : cal[2];
      calMin = Math.min(calMin, assigned);
      calMax = Math.max(calMax, assigned);
      nll += -Math.log(assigned);
    }

    if (nll < bestNll) {
      bestNll = nll;
      bestT = t;
      calibratedRange = [calMin, calMax];
    }
  }

  const atBoundary = bestT <= tMin + step || bestT >= tMax - step;

  return {
    method: 'temperature-scaling',
    T: Number(bestT.toFixed(3)),
    fitted_on: fittedOn,
    n_train: dists.length,
    train_logloss: Number((bestNll / Math.max(1, dists.length)).toFixed(5)),
    at_boundary: atBoundary,
    original_range: originalRange,
    calibrated_range: calibratedRange,
  };
}

export function applyBinaryTemperature(p: number, T: number): number {
  return binaryCalibrated(p, T);
}

export function applyBinaryPlatt(p: number, a: number, b: number): number {
  const z = a * logit(p) + b;
  return sigmoid(z);
}

export function applySoftmaxTemperature(
  dist: { pHome: number; pDraw: number; pAway: number },
  T: number
): { pHome: number; pDraw: number; pAway: number } {
  const cal = softmaxCalibrated([dist.pHome, dist.pDraw, dist.pAway], T);
  return { pHome: cal[0], pDraw: cal[1], pAway: cal[2] };
}
