/**
 * BTTS MATHEMATICAL BASELINE ENGINE
 * Model Version: BTTS-jointscore-v1.0.0
 * Location: src/lib/research/bttsEngine.ts
 *
 * Implements Both Teams To Score (BTTS) probabilities derived directly from the
 * Dixon-Coles bivariate joint score distribution P(Home = x, Away = y).
 *
 * Mathematical Invariants:
 * 1. P(BTTS YES) = 1 - P(Home = 0) - P(Away = 0) + P(Home = 0, Away = 0)
 * 2. P(BTTS NO)  = 1 - P(BTTS YES)
 * 3. P(BTTS YES) + P(BTTS NO) = 1.0 +/- 1e-9
 * 4. Yield & Calibration remain UNVALIDATED (No commercial EV/yield claims without real data)
 */

import { buildScoreGrid } from '../engine/probability';

export const BTTS_MODEL_VERSION = 'BTTS-jointscore-v1.0.0' as const;

export type BttsSelection = 'YES' | 'NO';
export type BttsOutcome = 'WIN' | 'LOSS';

export interface BttsProbabilities {
  yes: number;
  no: number;
}

export interface BttsEngineResult {
  modelVersion: typeof BTTS_MODEL_VERSION;
  probabilities: BttsProbabilities;
  pHomeZero: number;
  pAwayZero: number;
  pBothZero: number;
  fairOdds: {
    yes: number;
    no: number;
  };
  yieldStatus: 'UNVALIDATED';
  calibrationStatus: 'UNVALIDATED';
  provenance: {
    homeXG: number;
    awayXG: number;
    rho: number;
    gridSum: number;
  };
}

/**
 * Calculates BTTS probabilities directly from a precomputed joint score grid.
 * Ensures the single source of truth architecture where all markets derive from
 * the same underlying score distribution.
 */
export function calculateBttsFromGrid(
  grid: number[][],
  meta: { homeXG?: number; awayXG?: number; rho?: number } = {}
): BttsEngineResult {
  if (!grid || grid.length < 2 || !grid[0] || grid[0].length < 2) {
    throw new Error('[BttsEngine] Invalid score grid dimensions.');
  }

  const maxGoals = grid.length - 1;
  let gridSum = 0;
  let pHomeZero = 0;
  let pAwayZero = 0;

  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) {
      const prob = grid[x][y];
      if (Number.isNaN(prob) || !Number.isFinite(prob) || prob < 0) {
        throw new Error(`[BttsEngine] Corrupted probability at (${x}, ${y}): ${prob}`);
      }
      gridSum += prob;
      if (x === 0) pHomeZero += prob;
      if (y === 0) pAwayZero += prob;
    }
  }

  if (Math.abs(gridSum - 1.0) > 1e-4) {
    throw new Error(`[BttsEngine] Grid is not properly normalized. Sum = ${gridSum}`);
  }

  const pBothZero = grid[0][0];

  // Inclusion-Exclusion formula:
  // P(Yes) = 1 - P(Home = 0) - P(Away = 0) + P(Home = 0, Away = 0)
  let pYes = 1.0 - pHomeZero - pAwayZero + pBothZero;

  // Numerical safeguard: clamp to [0, 1] against minor floating point representation imprecision
  pYes = Math.max(0.0, Math.min(1.0, pYes));
  const pNo = Math.max(0.0, Math.min(1.0, 1.0 - pYes));

  // Verification against direct cell summation
  let directSumYes = 0;
  for (let x = 1; x <= maxGoals; x++) {
    for (let y = 1; y <= maxGoals; y++) {
      directSumYes += grid[x][y];
    }
  }

  if (Math.abs(pYes - directSumYes) > 1e-6) {
    throw new Error(`[BttsEngine] Inclusion-exclusion (${pYes}) does not match direct grid sum (${directSumYes})`);
  }

  const fairOddsYes = pYes > 0 ? Number((1 / pYes).toFixed(4)) : Infinity;
  const fairOddsNo = pNo > 0 ? Number((1 / pNo).toFixed(4)) : Infinity;

  return {
    modelVersion: BTTS_MODEL_VERSION,
    probabilities: {
      yes: pYes,
      no: pNo,
    },
    pHomeZero,
    pAwayZero,
    pBothZero,
    fairOdds: {
      yes: fairOddsYes,
      no: fairOddsNo,
    },
    yieldStatus: 'UNVALIDATED',
    calibrationStatus: 'UNVALIDATED',
    provenance: {
      homeXG: meta.homeXG ?? 0,
      awayXG: meta.awayXG ?? 0,
      rho: meta.rho ?? 0,
      gridSum,
    },
  };
}

/**
 * Calculates BTTS probabilities from xG parameters and Dixon-Coles rho.
 */
export function calculateBtts(
  homeXG: number,
  awayXG: number,
  rho = -0.04
): BttsEngineResult {
  if (homeXG < 0 || awayXG < 0 || Number.isNaN(homeXG) || Number.isNaN(awayXG)) {
    throw new Error(`[BttsEngine] Invalid xG values: homeXG=${homeXG}, awayXG=${awayXG}`);
  }

  const grid = buildScoreGrid(homeXG, awayXG, rho);
  return calculateBttsFromGrid(grid, { homeXG, awayXG, rho });
}

/**
 * Deterministically settles a BTTS selection given observed actual goals.
 */
export function settleBttsMatch(
  selection: BttsSelection,
  homeGoals: number,
  awayGoals: number
): BttsOutcome {
  if (
    homeGoals < 0 ||
    awayGoals < 0 ||
    !Number.isInteger(homeGoals) ||
    !Number.isInteger(awayGoals)
  ) {
    throw new Error(`[BttsEngine] Invalid goals for settlement: ${homeGoals}-${awayGoals}`);
  }

  const bothScored = homeGoals >= 1 && awayGoals >= 1;
  const isYesSelection = selection === 'YES';

  if (bothScored) {
    return isYesSelection ? 'WIN' : 'LOSS';
  } else {
    return isYesSelection ? 'LOSS' : 'WIN';
  }
}

