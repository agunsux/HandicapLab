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

export interface AsianTotalProbabilities {
  win: number;
  halfWin: number;
  push: number;
  halfLoss: number;
  loss: number;
  cover: number; // Combined probability equivalent (win + 0.5 * halfWin)
}

/**
 * Calculates exact Asian Total (Over / Under) probabilities across any line
 * (whole e.g. 2.0, 3.0; half e.g. 1.5, 2.5; quarter e.g. 2.25, 2.75).
 * Resolves full win, half win, push, half loss, full loss based on exact split stake rules.
 */
export function calculateAsianTotalProbability(
  homeXG: number,
  awayXG: number,
  line: number,
  isOver: boolean,
  rho: number
): AsianTotalProbabilities {
  const grid = buildScoreGrid(homeXG, awayXG, rho);
  const frac = Math.round((line - Math.floor(line)) * 100) / 100;

  let win = 0;
  let halfWin = 0;
  let push = 0;
  let halfLoss = 0;
  let loss = 0;

  for (let x = 0; x <= 10; x++) {
    for (let y = 0; y <= 10; y++) {
      const prob = grid[x][y];
      const totalGoals = x + y;

      if (frac === 0.0) {
        // 1. Whole line (e.g. 1.0, 2.0, 3.0)
        if (totalGoals === line) {
          push += prob;
        } else if (isOver) {
          if (totalGoals > line) win += prob;
          else loss += prob;
        } else {
          if (totalGoals < line) win += prob;
          else loss += prob;
        }
      } else if (frac === 0.5) {
        // 2. Half line (e.g. 0.5, 1.5, 2.5, 3.5)
        if (isOver) {
          if (totalGoals > line) win += prob;
          else loss += prob;
        } else {
          if (totalGoals < line) win += prob;
          else loss += prob;
        }
      } else if (frac === 0.25) {
        // 3. Quarter line .25 (e.g. 2.25) -> split whole (line - 0.25) and half (line + 0.25)
        const wholeLine = line - 0.25;
        if (isOver) {
          if (totalGoals >= line + 0.75) win += prob;
          else if (totalGoals === wholeLine) halfLoss += prob;
          else loss += prob;
        } else {
          if (totalGoals <= line - 1.25) win += prob;
          else if (totalGoals === wholeLine) halfWin += prob;
          else loss += prob;
        }
      } else if (frac === 0.75) {
        // 4. Quarter line .75 (e.g. 2.75) -> split half (line - 0.25) and whole (line + 0.25)
        const wholeLine = line + 0.25;
        if (isOver) {
          if (totalGoals >= line + 1.25) win += prob;
          else if (totalGoals === wholeLine) halfWin += prob;
          else loss += prob;
        } else {
          if (totalGoals <= line - 0.75) win += prob;
          else if (totalGoals === wholeLine) halfLoss += prob;
          else loss += prob;
        }
      } else {
        // Fallback for non-standard line
        if (isOver) {
          if (totalGoals > line) win += prob;
          else loss += prob;
        } else {
          if (totalGoals < line) win += prob;
          else loss += prob;
        }
      }
    }
  }

  return {
    win: Number(win.toFixed(5)),
    halfWin: Number(halfWin.toFixed(5)),
    push: Number(push.toFixed(5)),
    halfLoss: Number(halfLoss.toFixed(5)),
    loss: Number(loss.toFixed(5)),
    cover: Number((win + 0.5 * halfWin).toFixed(5)),
  };
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

      if (dAdj >= 0.4999) {
        win += prob;
      } else if (Math.abs(dAdj - 0.25) < 1e-4) {
        halfWin += prob;
      } else if (Math.abs(dAdj) < 1e-4) {
        push += prob;
      } else if (Math.abs(dAdj - (-0.25)) < 1e-4) {
        halfLoss += prob;
      } else {
        loss += prob;
      }
    }
  }

  return {
    win: Number(win.toFixed(5)),
    halfWin: Number(halfWin.toFixed(5)),
    push: Number(push.toFixed(5)),
    halfLoss: Number(halfLoss.toFixed(5)),
    loss: Number(loss.toFixed(5)),
    cover: Number((win + 0.5 * halfWin).toFixed(5)),
  };
}

/**
 * Calculates Moneyline (1X2) probabilities: Home Win, Draw, Away Win.
 */
export function calculate1X2Probability(
  homeXG: number,
  awayXG: number,
  rho: number
): { home: number; draw: number; away: number } {
  const grid = buildScoreGrid(homeXG, awayXG, rho);
  let home = 0;
  let draw = 0;
  let away = 0;

  for (let x = 0; x <= 10; x++) {
    for (let y = 0; y <= 10; y++) {
      const prob = grid[x][y];
      if (x > y) {
        home += prob;
      } else if (x === y) {
        draw += prob;
      } else {
        away += prob;
      }
    }
  }

  return { home, draw, away };
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

