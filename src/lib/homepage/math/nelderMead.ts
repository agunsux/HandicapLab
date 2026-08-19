// Pure TypeScript Nelder–Mead simplex optimizer (unconstrained), used to fit
// the Dixon-Coles parameters by MLE without requiring scipy/numpy at runtime.

export interface OptimizerResult {
  x: number[];
  fun: number;
  iterations: number;
  success: boolean;
}

export function nelderMead(
  objective: (x: number[]) => number,
  x0: number[],
  options: { maxIter?: number; ftol?: number; xtol?: number } = {}
): OptimizerResult {
  const maxIter = options.maxIter ?? 300;
  const ftol = options.ftol ?? 1e-9;
  const xtol = options.xtol ?? 1e-10;

  const n = x0.length;
  const simplex: { x: number[]; f: number }[] = [{ x: [...x0], f: objective(x0) }];
  const step = n === 1 ? 0.00025 : 0.05;

  for (let i = 0; i < n; i++) {
    const x = [...x0];
    x[i] = x0[i] === 0 ? step : x0[i] * (1 + step);
    simplex.push({ x, f: objective(x) });
  }

  for (let iter = 0; iter < maxIter; iter++) {
    simplex.sort((a, b) => a.f - b.f);
    const worst = simplex[n];

    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroid[j] += simplex[i].x[j];
    }
    for (let j = 0; j < n; j++) centroid[j] /= n;

    const alpha = 1.0;
    const gamma = 2.0;
    const rho = 0.5;
    const sigma = 0.5;

    const reflected = centroid.map((c, j) => c + alpha * (c - worst.x[j]));
    const fr = objective(reflected);

    if (fr < simplex[0].f) {
      const expanded = centroid.map((c, j) => c + gamma * (reflected[j] - c));
      const fe = objective(expanded);
      if (fe < fr) simplex[n] = { x: expanded, f: fe };
      else simplex[n] = { x: reflected, f: fr };
    } else if (fr < simplex[n - 1].f) {
      simplex[n] = { x: reflected, f: fr };
    } else {
      const contracted = centroid.map((c, j) => c + rho * (worst.x[j] - c));
      const fc = objective(contracted);
      if (fc < worst.f) {
        simplex[n] = { x: contracted, f: fc };
      } else {
        for (let i = 1; i <= n; i++) {
          for (let j = 0; j < n; j++) {
            simplex[i].x[j] = simplex[0].x[j] + sigma * (simplex[i].x[j] - simplex[0].x[j]);
          }
          simplex[i].f = objective(simplex[i].x);
        }
      }
    }

    const fRange = Math.abs(simplex[n].f - simplex[0].f);
    let xRange = 0;
    for (let i = 1; i <= n; i++) {
      let d = 0;
      for (let j = 0; j < n; j++) d += Math.abs(simplex[i].x[j] - simplex[0].x[j]);
      xRange = Math.max(xRange, d);
    }
    if (fRange <= ftol && xRange <= xtol) {
      simplex.sort((a, b) => a.f - b.f);
      return { x: simplex[0].x, fun: simplex[0].f, iterations: iter + 1, success: true };
    }
  }

  simplex.sort((a, b) => a.f - b.f);
  return { x: simplex[0].x, fun: simplex[0].f, iterations: maxIter, success: true };
}