export interface TemperatureFit {
  method: 'temperature-scaling';
  T: number;
  fitted_on: string[];
  n_train: number;
  train_logloss: number;
  at_boundary: boolean;
}

function binaryCalibrated(p: number, T: number): number {
  const pc = Math.min(0.999999, Math.max(0.000001, p));
  const q = Math.pow(pc, T);
  const r = Math.pow(1 - pc, T);
  return q / (q + r);
}

function softmaxCalibrated(dist: number[], T: number): number[] {
  const logits = dist.map((p) => Math.log(Math.min(0.999999, Math.max(0.000001, p))) / T);
  const maxL = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxL));
  const sum = exps.reduce((s, v) => s + v, 0);
  return exps.map((v) => v / sum);
}

export function fitBinaryTemperature(
  probs: number[],
  outcomes: boolean[],
  fittedOn: string[],
  tMin = 0.05,
  tMax = 20.0,
  step = 0.05
): TemperatureFit {
  let bestT = 1;
  let bestNll = Infinity;
  for (let t = tMin; t <= tMax + 1e-9; t += step) {
    let nll = 0;
    for (let i = 0; i < probs.length; i++) {
      const pc = binaryCalibrated(probs[i], t);
      nll += -Math.log(outcomes[i] ? pc : 1 - pc);
    }
    if (nll < bestNll) {
      bestNll = nll;
      bestT = t;
    }
  }
  return {
    method: 'temperature-scaling',
    T: Number(bestT.toFixed(3)),
    fitted_on: fittedOn,
    n_train: probs.length,
    train_logloss: Number((bestNll / Math.max(1, probs.length)).toFixed(5)),
    at_boundary: bestT <= tMin + step || bestT >= tMax - step,
  };
}

export function fitSoftmaxTemperature(
  dists: Array<{ pHome: number; pDraw: number; pAway: number }>,
  outcomes: Array<'H' | 'D' | 'A'>,
  fittedOn: string[],
  tMin = 0.05,
  tMax = 20.0,
  step = 0.05
): TemperatureFit {
  let bestT = 1;
  let bestNll = Infinity;
  for (let t = tMin; t <= tMax + 1e-9; t += step) {
    let nll = 0;
    for (let i = 0; i < dists.length; i++) {
      const cal = softmaxCalibrated([dists[i].pHome, dists[i].pDraw, dists[i].pAway], t);
      const assigned = outcomes[i] === 'H' ? cal[0] : outcomes[i] === 'D' ? cal[1] : cal[2];
      nll += -Math.log(assigned);
    }
    if (nll < bestNll) {
      bestNll = nll;
      bestT = t;
    }
  }
  return {
    method: 'temperature-scaling',
    T: Number(bestT.toFixed(3)),
    fitted_on: fittedOn,
    n_train: dists.length,
    train_logloss: Number((bestNll / Math.max(1, dists.length)).toFixed(5)),
    at_boundary: bestT <= tMin + step || bestT >= tMax - step,
  };
}

export function applyBinaryTemperature(p: number, T: number): number {
  return binaryCalibrated(p, T);
}

export function applySoftmaxTemperature(dist: { pHome: number; pDraw: number; pAway: number }, T: number): { pHome: number; pDraw: number; pAway: number } {
  const cal = softmaxCalibrated([dist.pHome, dist.pDraw, dist.pAway], T);
  return { pHome: cal[0], pDraw: cal[1], pAway: cal[2] };
}
