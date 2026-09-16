/**
 * ASIAN TOTAL GOALS ENGINE — MATHEMATICAL BASELINE
 * Model Version: ASIAN-TOTAL-jointscore-v1.0.0
 * Location: src/lib/engine/asianTotalEngine.ts
 *
 * Implements generic Asian Total Goals probabilities (Over / Under) directly derived
 * from the Dixon-Coles bivariate joint score distribution P(Home = x, Away = y).
 *
 * Supports Whole (2.0, 3.0, 4.0), Half (2.5, 3.5), and Quarter (2.25, 2.75, 3.25, 3.75) lines.
 *
 * Mathematical Invariants:
 * 1. P(Total Goals = t) = sum_{x+y=t} P(x, y)
 * 2. sum_{t=0}^{20} P(T = t) = 1.0 +/- 1e-9
 * 3. P(fullWin) + P(halfWin) + P(push) + P(halfLoss) + P(fullLoss) = 1.0 +/- 1e-9
 * 4. Yield & Calibration remain UNVALIDATED (No commercial EV/yield claims without real data)
 */

import { buildScoreGrid } from './probability';

export const ASIAN_TOTAL_MODEL_VERSION = 'ASIAN-TOTAL-jointscore-v1.0.0' as const;

export type AsianTotalSide = 'OVER' | 'UNDER';

export type AsianTotalSettlementOutcome =
  | 'FULL_WIN'
  | 'HALF_WIN'
  | 'PUSH'
  | 'HALF_LOSS'
  | 'FULL_LOSS';

export const VALID_ASIAN_TOTAL_LINES = [
  2.0, 2.25, 2.5, 2.75,
  3.0, 3.25, 3.5, 3.75,
  4.0,
] as const;

export type ValidAsianTotalLine = typeof VALID_ASIAN_TOTAL_LINES[number];

export class InvalidAsianLineError extends Error {
  constructor(line: number) {
    super(
      `[AsianTotalEngine] Invalid Asian Total line: ${line}. Supported research lines are [${VALID_ASIAN_TOTAL_LINES.join(
        ', '
      )}] in 0.25 increments.`
    );
    this.name = 'InvalidAsianLineError';
  }
}

export interface AsianTotalSettlementProbabilities {
  fullWin: number;
  halfWin: number;
  push: number;
  halfLoss: number;
  fullLoss: number;
}

export interface AsianTotalResult {
  modelVersion: typeof ASIAN_TOTAL_MODEL_VERSION;
  line: number;
  side: AsianTotalSide;
  probabilities: AsianTotalSettlementProbabilities;
  binaryWinProbability: number;
  coverProbability: number;
  fairOdds: {
    binary: number;
    cover: number;
  };
  yieldStatus: 'UNVALIDATED';
  calibrationStatus: 'UNVALIDATED';
  totalGoalsDistribution: number[];
  provenance: {
    homeXG: number;
    awayXG: number;
    rho: number;
    gridSum: number;
  };
}

/**
 * Validates whether a line is supported in the Asian Total research universe (2.0 to 4.0 in 0.25 steps).
 */
export function validateAsianTotalLine(line: number): asserts line is ValidAsianTotalLine {
  if (typeof line !== 'number' || Number.isNaN(line) || !Number.isFinite(line)) {
    throw new InvalidAsianLineError(line);
  }
  const match = VALID_ASIAN_TOTAL_LINES.some((v) => Math.abs(v - line) < 1e-6);
  if (!match) {
    throw new InvalidAsianLineError(line);
  }
}

/**
 * Normalizes user input side to strictly 'OVER' | 'UNDER'.
 */
export function normalizeAsianSide(side: string): AsianTotalSide {
  const s = String(side).trim().toUpperCase();
  if (s !== 'OVER' && s !== 'UNDER') {
    throw new Error(`[AsianTotalEngine] Invalid side '${side}'. Must be 'OVER' or 'UNDER'.`);
  }
  return s as AsianTotalSide;
}

/**
 * Derives the 1D total goals distribution P(T = t) for t = 0..20 from the 2D joint score grid.
 */
export function deriveTotalGoalsDistribution(grid: number[][]): number[] {
  if (!grid || grid.length < 2 || !grid[0] || grid[0].length < 2) {
    throw new Error('[AsianTotalEngine] Invalid score grid dimensions.');
  }

  const maxGoals = grid.length - 1;
  const maxTotal = maxGoals * 2;
  const dist: number[] = new Array(maxTotal + 1).fill(0);

  let gridSum = 0;
  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) {
      const prob = grid[x][y];
      if (Number.isNaN(prob) || !Number.isFinite(prob) || prob < 0) {
        throw new Error(`[AsianTotalEngine] Corrupted probability at (${x}, ${y}): ${prob}`);
      }
      gridSum += prob;
      dist[x + y] += prob;
    }
  }

  if (Math.abs(gridSum - 1.0) > 1e-4) {
    throw new Error(`[AsianTotalEngine] Grid is not properly normalized. Sum = ${gridSum}`);
  }

  // Renormalize distribution array to guarantee exact 1.0 sum
  const distSum = dist.reduce((acc, p) => acc + p, 0);
  if (distSum > 0) {
    for (let i = 0; i <= maxTotal; i++) {
      dist[i] /= distSum;
    }
  }

  return dist;
}

/**
 * Deterministically settles an Asian Total Goals selection against observed total match goals.
 */
export function settleAsianTotalGoals(
  line: number,
  side: AsianTotalSide | string,
  totalGoals: number
): AsianTotalSettlementOutcome {
  validateAsianTotalLine(line);
  const normalizedSide = normalizeAsianSide(side);
  if (
    totalGoals < 0 ||
    !Number.isInteger(totalGoals) ||
    Number.isNaN(totalGoals) ||
    !Number.isFinite(totalGoals)
  ) {
    throw new Error(`[AsianTotalEngine] Invalid total goals for settlement: ${totalGoals}`);
  }

  const isOver = normalizedSide === 'OVER';
  const frac = Math.round((line - Math.floor(line)) * 100) / 100;

  // 1. Whole line (e.g. 2.0, 3.0, 4.0)
  if (frac === 0.0) {
    if (totalGoals === line) return 'PUSH';
    if (isOver) {
      return totalGoals > line ? 'FULL_WIN' : 'FULL_LOSS';
    } else {
      return totalGoals < line ? 'FULL_WIN' : 'FULL_LOSS';
    }
  }

  // 2. Half line (e.g. 2.5, 3.5)
  if (frac === 0.5) {
    if (isOver) {
      return totalGoals > line ? 'FULL_WIN' : 'FULL_LOSS';
    } else {
      return totalGoals < line ? 'FULL_WIN' : 'FULL_LOSS';
    }
  }

  // 3. Quarter line .25 (e.g. 2.25, 3.25)
  // Split between whole line (line - 0.25) and half line (line + 0.25)
  if (frac === 0.25) {
    const wholeLine = line - 0.25;
    if (isOver) {
      if (totalGoals >= line + 0.75) return 'FULL_WIN';
      if (totalGoals === wholeLine) return 'HALF_LOSS'; // whole line pushes, half line loses
      return 'FULL_LOSS';
    } else {
      if (totalGoals <= line - 1.25) return 'FULL_WIN';
      if (totalGoals === wholeLine) return 'HALF_WIN'; // whole line pushes, half line wins
      return 'FULL_LOSS';
    }
  }

  // 4. Quarter line .75 (e.g. 2.75, 3.75)
  // Split between half line (line - 0.25) and whole line (line + 0.25)
  if (frac === 0.75) {
    const wholeLine = line + 0.25;
    if (isOver) {
      if (totalGoals >= line + 1.25) return 'FULL_WIN';
      if (totalGoals === wholeLine) return 'HALF_WIN'; // half line wins, whole line pushes
      return 'FULL_LOSS';
    } else {
      if (totalGoals <= line - 0.75) return 'FULL_WIN';
      if (totalGoals === wholeLine) return 'HALF_LOSS'; // half line loses, whole line pushes
      return 'FULL_LOSS';
    }
  }

  throw new InvalidAsianLineError(line);
}

/**
 * Calculates generic Asian Total Goals probabilities from a precomputed joint score grid.
 */
export function calculateAsianTotalFromGrid(
  grid: number[][],
  line: number,
  sideInput: AsianTotalSide | string,
  meta: { homeXG?: number; awayXG?: number; rho?: number } = {}
): AsianTotalResult {
  validateAsianTotalLine(line);
  const side = normalizeAsianSide(sideInput);
  const totalGoalsDist = deriveTotalGoalsDistribution(grid);

  // Derive the 5 settlement outcome probabilities by exact convolution over total goals distribution
  let fullWin = 0;
  let halfWin = 0;
  let push = 0;
  let halfLoss = 0;
  let fullLoss = 0;

  for (let t = 0; t < totalGoalsDist.length; t++) {
    const pt = totalGoalsDist[t];
    if (pt <= 0) continue;

    const outcome = settleAsianTotalGoals(line, side, t);
    switch (outcome) {
      case 'FULL_WIN':
        fullWin += pt;
        break;
      case 'HALF_WIN':
        halfWin += pt;
        break;
      case 'PUSH':
        push += pt;
        break;
      case 'HALF_LOSS':
        halfLoss += pt;
        break;
      case 'FULL_LOSS':
        fullLoss += pt;
        break;
    }
  }

  const sumProbs = fullWin + halfWin + push + halfLoss + fullLoss;
  if (Math.abs(sumProbs - 1.0) > 1e-4) {
    throw new Error(
      `[AsianTotalEngine] Settlement probabilities sum to ${sumProbs}, expected 1.0`
    );
  }

  // Renormalize strictly to eliminate any residual float representation drift
  const normFullWin = fullWin / sumProbs;
  const normHalfWin = halfWin / sumProbs;
  const normPush = push / sumProbs;
  const normHalfLoss = halfLoss / sumProbs;
  const normFullLoss = fullLoss / sumProbs;

  // Distinct metrics per section 15
  const binaryWinProbability = normFullWin;
  const coverProbability = normFullWin + 0.5 * normHalfWin;

  const fairOddsBinary = binaryWinProbability > 0 ? Number((1 / binaryWinProbability).toFixed(4)) : Infinity;
  const fairOddsCover = coverProbability > 0 ? Number((1 / coverProbability).toFixed(4)) : Infinity;

  return {
    modelVersion: ASIAN_TOTAL_MODEL_VERSION,
    line,
    side,
    probabilities: {
      fullWin: normFullWin,
      halfWin: normHalfWin,
      push: normPush,
      halfLoss: normHalfLoss,
      fullLoss: normFullLoss,
    },
    binaryWinProbability,
    coverProbability,
    fairOdds: {
      binary: fairOddsBinary,
      cover: fairOddsCover,
    },
    yieldStatus: 'UNVALIDATED',
    calibrationStatus: 'UNVALIDATED',
    totalGoalsDistribution: totalGoalsDist,
    provenance: {
      homeXG: meta.homeXG ?? 0,
      awayXG: meta.awayXG ?? 0,
      rho: meta.rho ?? 0,
      gridSum: totalGoalsDist.reduce((a, b) => a + b, 0),
    },
  };
}

/**
 * Asian Total Goals Engine class providing static calculation methods.
 */
export class AsianTotalEngine {
  public static readonly MODEL_VERSION = ASIAN_TOTAL_MODEL_VERSION;

  /**
   * Generic Line API: totalGoals(line, side, homeXG, awayXG, rho)
   */
  public static totalGoals(
    line: number,
    side: AsianTotalSide | string,
    homeXG: number,
    awayXG: number,
    rho = -0.04
  ): AsianTotalResult {
    const grid = buildScoreGrid(homeXG, awayXG, rho);
    return calculateAsianTotalFromGrid(grid, line, side, { homeXG, awayXG, rho });
  }

  /**
   * Calculate from pre-existing score grid.
   */
  public static calculateFromGrid(
    grid: number[][],
    line: number,
    side: AsianTotalSide | string,
    meta: { homeXG?: number; awayXG?: number; rho?: number } = {}
  ): AsianTotalResult {
    return calculateAsianTotalFromGrid(grid, line, side, meta);
  }
}

/**
 * Convenience procedural function: totalGoals(line, side, homeXG, awayXG, rho)
 */
export function totalGoals(
  line: number,
  side: AsianTotalSide | string,
  homeXG: number,
  awayXG: number,
  rho = -0.04
): AsianTotalResult {
  return AsianTotalEngine.totalGoals(line, side, homeXG, awayXG, rho);
}
