// AH EDGE ENGINE — Probability mathematics.
//
// Settlement-aware probability derivation from a goal-difference PMF.
// This mirrors the VALIDATED settlement rules in src/lib/research/ah-yield
// (quarter lines split into adjacent half-lines) but is implemented here as an
// exact, unrounded probability map, and cross-checked against the settlement
// engine on an exhaustive grid in tests.

import type { AhSide } from '../ah-yield/ahTypes';
import { isQuarterHandicap } from '../ah-yield/ahSettlement';

export interface AhCategoryProbabilities {
  pFullWin: number;
  pHalfWin: number;
  pPush: number;
  pHalfLoss: number;
  pFullLoss: number;
}

export const CATEGORY_KEYS = ['pFullWin', 'pHalfWin', 'pPush', 'pHalfLoss', 'pFullLoss'] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const CATEGORIES: CategoryKey[] = [...CATEGORY_KEYS];

/** Category index used for 5-class scoring: 0=FW, 1=HW, 2=P, 3=HL, 4=FL. */
export function settlementCategoryIndex(outcome: string): number {
  switch (outcome) {
    case 'FULL_WIN': return 0;
    case 'HALF_WIN': return 1;
    case 'PUSH': return 2;
    case 'HALF_LOSS': return 3;
    case 'FULL_LOSS': return 4;
    default: return -1;
  }
}

export function categoriesToArray(p: AhCategoryProbabilities): number[] {
  return [p.pFullWin, p.pHalfWin, p.pPush, p.pHalfLoss, p.pFullLoss];
}

export function arrayToCategories(a: number[]): AhCategoryProbabilities {
  return { pFullWin: a[0], pHalfWin: a[1], pPush: a[2], pHalfLoss: a[3], pFullLoss: a[4] };
}

export function normalizeCategories(p: AhCategoryProbabilities): AhCategoryProbabilities {
  const sum = p.pFullWin + p.pHalfWin + p.pPush + p.pHalfLoss + p.pFullLoss;
  if (!(sum > 0)) {
    return { pFullWin: 0.2, pHalfWin: 0.2, pPush: 0.2, pHalfLoss: 0.2, pFullLoss: 0.2 };
  }
  return {
    pFullWin: p.pFullWin / sum,
    pHalfWin: p.pHalfWin / sum,
    pPush: p.pPush / sum,
    pHalfLoss: p.pHalfLoss / sum,
    pFullLoss: p.pFullLoss / sum,
  };
}

export function poissonPmf(k: number, lambda: number): number {
  if (k < 0) return 0;
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
}

/**
 * Exact goal-difference PMF for independent Poisson goals, truncated at
 * maxGoals per side and renormalized (truncation mass < 1e-8 for lambda <= 6).
 */
export function goalDifferencePmf(lambdaHome: number, lambdaAway: number, maxGoals = 15): Record<number, number> {
  const lh = Math.min(Math.max(lambdaHome, 1e-6), 8);
  const la = Math.min(Math.max(lambdaAway, 1e-6), 8);
  const ph: number[] = [];
  const pa: number[] = [];
  for (let k = 0; k <= maxGoals; k++) {
    ph.push(poissonPmf(k, lh));
    pa.push(poissonPmf(k, la));
  }
  const pmf: Record<number, number> = {};
  let total = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = ph[h] * pa[a];
      const gd = h - a;
      pmf[gd] = (pmf[gd] ?? 0) + p;
      total += p;
    }
  }
  for (const key of Object.keys(pmf)) {
    pmf[Number(key)] = pmf[Number(key)] / total;
  }
  return pmf;
}

/** One half/whole-line component: settle margin m = gd + line. */
function componentSign(margin: number): number {
  if (margin > 1e-9) return 1;
  if (margin < -1e-9) return -1;
  return 0;
}

/**
 * Exact settlement probabilities for a side/line from a goal-difference PMF.
 * Enumerates each goal difference and classifies the bet with the same
 * quarter-line split rules as the validated settlement engine.
 */
export function settlementProbabilitiesFromPmf(
  pmf: Record<number, number>,
  line: number,
  side: AhSide
): AhCategoryProbabilities {
  // `line` is the HOME-perspective line; the selected side settles against its
  // own mirrored line (away +L equals home -L).
  const sideLine = side === 'home' ? line : -line;
  const quarter = isQuarterHandicap(sideLine);
  const base = quarter ? Math.floor(sideLine * 2) / 2 : sideLine;
  const line2 = quarter ? base + 0.5 : sideLine;

  let pFullWin = 0;
  let pHalfWin = 0;
  let pPush = 0;
  let pHalfLoss = 0;
  let pFullLoss = 0;

  for (const gdStr of Object.keys(pmf)) {
    const gd = Number(gdStr);
    const prob = pmf[gd];
    if (!(prob > 0)) continue;
    const sideGd = side === 'home' ? gd : -gd;
    const s1 = componentSign(sideGd + base);
    if (!quarter) {
      if (s1 > 0) pFullWin += prob;
      else if (s1 < 0) pFullLoss += prob;
      else pPush += prob;
      continue;
    }
    const s2 = componentSign(sideGd + line2);
    if (s1 > 0 && s2 > 0) pFullWin += prob;
    else if (s1 < 0 && s2 < 0) pFullLoss += prob;
    else if (s1 === 0 && s2 === 0) pPush += prob;
    else if ((s1 > 0 && s2 === 0) || (s1 === 0 && s2 > 0)) pHalfWin += prob;
    else if ((s1 < 0 && s2 === 0) || (s1 === 0 && s2 < 0)) pHalfLoss += prob;
    else pPush += prob;
  }

  return normalizeCategories({ pFullWin, pHalfWin, pPush, pHalfLoss, pFullLoss });
}

/** P(home win), P(draw), P(away win) from a GD PMF. */
export function outcomeProbabilitiesFromPmf(pmf: Record<number, number>): {
  pHome: number;
  pDraw: number;
  pAway: number;
} {
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (const gdStr of Object.keys(pmf)) {
    const gd = Number(gdStr);
    const p = pmf[gd];
    if (gd > 0) pHome += p;
    else if (gd < 0) pAway += p;
    else pDraw += p;
  }
  return { pHome, pDraw, pAway };
}

const FIT_MAX_GOALS = 12;

// Precomputed outcome-probability grid over (lambdaHome, lambdaAway).
// Built once, lazily; every fit starts from the grid best cell and refines
// locally. Deterministic and fast enough for thousands of per-match fits.
const GRID_MIN = 0.2;
const GRID_MAX = 3.8;
const GRID_STEP = 0.05;
const GRID_SIZE = Math.round((GRID_MAX - GRID_MIN) / GRID_STEP) + 1;

let outcomeGrid: Float64Array | null = null;

function outcomeProbsAt(lh: number, la: number): { pHome: number; pDraw: number; pAway: number } {
  const ph: number[] = [];
  const pa: number[] = [];
  for (let k = 0; k <= FIT_MAX_GOALS; k++) {
    ph.push(poissonPmf(k, lh));
    pa.push(poissonPmf(k, la));
  }
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (let h = 0; h <= FIT_MAX_GOALS; h++) {
    for (let a = 0; a <= FIT_MAX_GOALS; a++) {
      const p = ph[h] * pa[a];
      if (h > a) pHome += p;
      else if (h < a) pAway += p;
      else pDraw += p;
    }
  }
  const s = pHome + pDraw + pAway;
  return { pHome: pHome / s, pDraw: pDraw / s, pAway: pAway / s };
}

function getOutcomeGrid(): Float64Array {
  if (outcomeGrid) return outcomeGrid;
  const grid = new Float64Array(GRID_SIZE * GRID_SIZE * 3);
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      const p = outcomeProbsAt(GRID_MIN + i * GRID_STEP, GRID_MIN + j * GRID_STEP);
      const idx = (i * GRID_SIZE + j) * 3;
      grid[idx] = p.pHome;
      grid[idx + 1] = p.pDraw;
      grid[idx + 2] = p.pAway;
    }
  }
  outcomeGrid = grid;
  return grid;
}

function gridError(grid: Float64Array, i: number, j: number, target: { pHome: number; pDraw: number; pAway: number }): number {
  const idx = (i * GRID_SIZE + j) * 3;
  return (
    (grid[idx] - target.pHome) ** 2 +
    (grid[idx + 1] - target.pDraw) ** 2 +
    (grid[idx + 2] - target.pAway) ** 2
  );
}

const fitCache = new Map<string, { lambdaHome: number; lambdaAway: number; squaredError: number }>();

/**
 * Fit independent-Poisson rates (lambdaHome, lambdaAway) to observed 1X2
 * probabilities. Deterministic: coarse search on a precomputed grid, then a
 * local grid refinement. Results are cached by quantized target.
 */
export function fitIndependencePoissonToOutcomes(
  target: { pHome: number; pDraw: number; pAway: number }
): { lambdaHome: number; lambdaAway: number; squaredError: number } {
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const cacheKey = `${round(target.pHome)}|${round(target.pDraw)}|${round(target.pAway)}`;
  const cached = fitCache.get(cacheKey);
  if (cached) return cached;

  const grid = getOutcomeGrid();
  let bestI = 0;
  let bestJ = 0;
  let bestErr = Infinity;
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      const err = gridError(grid, i, j, target);
      if (err < bestErr) {
        bestErr = err;
        bestI = i;
        bestJ = j;
      }
    }
  }

  let bestLh = GRID_MIN + bestI * GRID_STEP;
  let bestLa = GRID_MIN + bestJ * GRID_STEP;
  let bestFineErr = bestErr;
  const fineStep = GRID_STEP / 5;
  for (let di = -5; di <= 5; di++) {
    for (let dj = -5; dj <= 5; dj++) {
      const lh = bestLh + di * fineStep;
      const la = bestLa + dj * fineStep;
      if (lh <= 0 || la <= 0 || lh > 6 || la > 6) continue;
      const p = outcomeProbsAt(lh, la);
      const err = (p.pHome - target.pHome) ** 2 + (p.pDraw - target.pDraw) ** 2 + (p.pAway - target.pAway) ** 2;
      if (err < bestFineErr) {
        bestFineErr = err;
        bestLh = lh;
        bestLa = la;
      }
    }
  }

  const result = {
    lambdaHome: Number(bestLh.toFixed(4)),
    lambdaAway: Number(bestLa.toFixed(4)),
    squaredError: Number(bestFineErr.toFixed(10)),
  };
  fitCache.set(cacheKey, result);
  return result;
}

/** Proportional 1X2 devig: p_i = (1/o_i) / sum(1/o_j). */
export function devigOneXTwo(home: number, draw: number, away: number): { pHome: number; pDraw: number; pAway: number } {
  for (const o of [home, draw, away]) {
    if (!Number.isFinite(o) || o <= 1) throw new Error(`devigOneXTwo: invalid odds ${String(o)}`);
  }
  const inv = 1 / home + 1 / draw + 1 / away;
  return { pHome: 1 / home / inv, pDraw: 1 / draw / inv, pAway: 1 / away / inv };
}

/** Proportional two-way devig (same convention as the validated yield engine). */
export function devigTwoWay(oddsA: number, oddsB: number): { pA: number; pB: number } {
  if (!Number.isFinite(oddsA) || oddsA <= 1 || !Number.isFinite(oddsB) || oddsB <= 1) {
    throw new Error('devigTwoWay: invalid odds');
  }
  const invA = 1 / oddsA;
  const invB = 1 / oddsB;
  return { pA: invA / (invA + invB), pB: invB / (invA + invB) };
}
