import { poissonPMF, dixonColesCorrection } from './math';

// Ensure this module is only imported/run on the server side
if (typeof window !== 'undefined') {
  throw new Error('Probability module can only be used on the server side.');
}

export interface TeamStrength {
  attack: number;
  defense: number;
}

/**
 * Calculates Expected Goals (xG) for both home and away teams.
 * All parameter inputs must be explicitly supplied (no hidden defaults).
 */
export function calculateExpectedGoals(
  homeStrength: TeamStrength,
  awayStrength: TeamStrength,
  leagueAvgGoals: number
): { homeXG: number; awayXG: number } {
  // Expected goals home = home attack * away defense * (league average goals per team per match)
  const teamAvgGoals = leagueAvgGoals / 2.0;
  const homeXG = homeStrength.attack * awayStrength.defense * teamAvgGoals;
  const awayXG = awayStrength.attack * homeStrength.defense * teamAvgGoals;
  return { homeXG, awayXG };
}

/**
 * Helper to build the joint probability distribution score grid (0 to 10 goals)
 * corrected via Dixon-Coles parameters. Returns a normalized grid where sum = 1.0.
 */
export function buildScoreGrid(
  homeXG: number,
  awayXG: number,
  rho: number
): number[][] {
  const maxGoals = 10;
  const grid: number[][] = Array.from({ length: maxGoals + 1 }, () =>
    new Array<number>(maxGoals + 1).fill(0)
  );

  let totalSum = 0;

  // Calculate joint probabilities
  for (let x = 0; x <= maxGoals; x++) {
    const pHome = poissonPMF(homeXG, x);
    for (let y = 0; y <= maxGoals; y++) {
      const pAway = poissonPMF(awayXG, y);
      const correction = dixonColesCorrection(x, y, homeXG, awayXG, rho);
      const prob = pHome * pAway * correction;
      grid[x][y] = prob;
      totalSum += prob;
    }
  }

  // Normalize grid to sum to 1.0 to handle truncation
  if (totalSum > 0) {
    for (let x = 0; x <= maxGoals; x++) {
      for (let y = 0; y <= maxGoals; y++) {
        grid[x][y] /= totalSum;
      }
    }
  }

  return grid;
}

/**
 * Calculates Over/Under Probability for a given goals threshold (e.g. 2.5).
 */
export function calculateOverUnderProbability(
  homeXG: number,
  awayXG: number,
  threshold: number,
  rho: number
): { over: number; under: number } {
  const grid = buildScoreGrid(homeXG, awayXG, rho);
  let under = 0;
  let over = 0;

  for (let x = 0; x <= 10; x++) {
    for (let y = 0; y <= 10; y++) {
      if (x + y < threshold) {
        under += grid[x][y];
      } else if (x + y > threshold) {
        over += grid[x][y];
      }
    }
  }

  return { over, under };
}

export interface AsianHandicapProbabilities {
  win: number;
  halfWin: number;
  push: number;
  halfLoss: number;
  loss: number;
  cover: number; // Combined probability equivalent (win + 0.5 * halfWin)
}

/**
 * Calculates Asian Handicap probabilities for the home team coverage.
 * Supports lines: -0.25, -0.5, -0.75, -1.0, +0.25, +0.5, +0.75, +1.0
 */
export function calculateAsianHandicapProbability(
  homeXG: number,
  awayXG: number,
  handicapLine: number, // relative to the home team
  rho: number
): AsianHandicapProbabilities {
  const grid = buildScoreGrid(homeXG, awayXG, rho);
  
  let win = 0;
  let halfWin = 0;
  let push = 0;
  let halfLoss = 0;
  let loss = 0;

  for (let x = 0; x <= 10; x++) {
    for (let y = 0; y <= 10; y++) {
      const prob = grid[x][y];
      // Adjusted goal difference for Home selection
      // Goal difference (x - y) + HandicapLine
      const dAdj = (x - y) + handicapLine;

      if (dAdj >= 0.5) {
        win += prob;
      } else if (dAdj === 0.25) {
        halfWin += prob;
      } else if (dAdj === 0.0) {
        push += prob;
      } else if (dAdj === -0.25) {
        halfLoss += prob;
      } else {
        loss += prob;
      }
    }
  }

  return {
    win,
    halfWin,
    push,
    halfLoss,
    loss,
    cover: win + 0.5 * halfWin,
  };
}

/**
 * Calculates Fair Odds based on the probability.
 * Formula: 1 / probability
 */
export function fairOdds(probability: number): number {
  if (probability <= 0) return Infinity;
  return 1 / probability;
}

/**
 * Calculates the Edge Percentage based on fair odds vs market odds.
 * Standard sports analytics direction: ((marketOdds / fairOdds) - 1) * 100
 */
export function edgePercentage(fairOdds: number, marketOdds: number): number {
  if (fairOdds <= 0 || marketOdds <= 0) return 0;
  return ((marketOdds / fairOdds) - 1) * 100;
}
