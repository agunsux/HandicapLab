import { describe, it, expect } from 'vitest';
import {
  poissonPMF,
  poissonCDF,
  dixonColesCorrection,
  kellyFraction,
  brierScore
} from '../math';
import {
  calculateExpectedGoals,
  buildScoreGrid,
  calculateOverUnderProbability,
  calculateAsianHandicapProbability,
  fairOdds,
  edgePercentage
} from '../probability';

describe('Quant Engine & Mathematical Core Tests', () => {

  // Test 1: Poisson Probabilities Valid
  describe('1. Poisson PMF and CDF Validity', () => {
    it('should calculate correct PMF values for known inputs', () => {
      // For lambda = 1.5, k = 2
      // PMF = 1.5^2 * exp(-1.5) / 2 = 2.25 * 0.22313 / 2 = 0.25102
      const pmf = poissonPMF(1.5, 2);
      expect(pmf).toBeCloseTo(0.251, 3);
    });

    it('should sum CDF to 1.0 for large k', () => {
      const cdf = poissonCDF(2.0, 15);
      expect(cdf).toBeCloseTo(1.0, 5);
    });

    it('should handle boundary and invalid inputs safely', () => {
      expect(poissonPMF(-1, 2)).toBe(0);
      expect(poissonPMF(2, -1)).toBe(0);
      expect(poissonPMF(2, 1.5)).toBe(0); // non-integer k
      expect(poissonCDF(-1, 2)).toBe(0);
      expect(poissonCDF(2, -1)).toBe(0);
    });
  });

  // Test 2: Home + Draw + Away probability ~= 1.0
  describe('2. Joint Probabilities (1X2) Sum to ~1.0', () => {
    it('should verify that Home, Draw, and Away win probabilities sum to exactly 1.0', () => {
      const homeXG = 1.6;
      const awayXG = 1.2;
      const rho = -0.1;
      
      const grid = buildScoreGrid(homeXG, awayXG, rho);
      
      let pHome = 0;
      let pDraw = 0;
      let pAway = 0;
      
      for (let x = 0; x <= 10; x++) {
        for (let y = 0; y <= 10; y++) {
          const prob = grid[x][y];
          if (x > y) {
            pHome += prob;
          } else if (x === y) {
            pDraw += prob;
          } else {
            pAway += prob;
          }
        }
      }
      
      const total = pHome + pDraw + pAway;
      expect(total).toBeCloseTo(1.0, 5);
    });
  });

  // Test 3: Fair Odds Consistency
  describe('3. Fair Odds Consistency', () => {
    it('should return exactly 1 / probability', () => {
      expect(fairOdds(0.5)).toBe(2.0);
      expect(fairOdds(0.25)).toBe(4.0);
      expect(fairOdds(0.0)).toBe(Infinity);
      expect(fairOdds(-0.1)).toBe(Infinity);
    });
  });

  // Test 4: Kelly Staking Fraction Never Negative
  describe('4. Kelly Fraction Bounds', () => {
    it('should calculate Kelly stakes correctly for positive edges', () => {
      // probability = 0.55, odds = 2.0 (fair is 1.818)
      // Edge is 10%
      // Kelly fraction = 0.55 - 0.45 / 1 = 0.10
      // half Kelly = 0.10 * 0.5 = 0.05
      const stake = kellyFraction(0.55, 2.0, 0.5);
      expect(stake).toBeCloseTo(0.05, 4);
    });

    it('should return 0 when edge is zero or negative', () => {
      // probability = 0.45, odds = 2.0 (expected return is 0.9, negative edge)
      expect(kellyFraction(0.45, 2.0, 0.5)).toBe(0);
      
      // probability = 0.50, odds = 2.0 (exact fair price, 0 edge)
      expect(kellyFraction(0.50, 2.0, 0.5)).toBe(0);
    });

    it('should return 0 for invalid inputs', () => {
      expect(kellyFraction(-0.5, 2.0, 0.5)).toBe(0);
      expect(kellyFraction(0.5, 0.9, 0.5)).toBe(0);
    });
  });

  // Test 5: Edge Formula Accuracy
  describe('5. Edge Formula Accuracy & Directionality', () => {
    it('should return positive edge when marketOdds > fairOdds (undervalued)', () => {
      const fair = 2.0;
      const market = 2.5;
      const edge = edgePercentage(fair, market); // ((2.5 / 2) - 1) * 100 = 25%
      expect(edge).toBeCloseTo(25.0, 5);
    });

    it('should return negative edge when marketOdds < fairOdds (overvalued)', () => {
      const fair = 2.0;
      const market = 1.8;
      const edge = edgePercentage(fair, market); // ((1.8 / 2) - 1) * 100 = -10%
      expect(edge).toBeCloseTo(-10.0, 5);
    });
  });

  // Test 6: Dixon-Coles Correction Changes Low Scoring Probabilities
  describe('6. Dixon-Coles Scoreline Correction', () => {
    it('should alter low-score probabilities and keep total grid sum close to 1.0', () => {
      const homeXG = 1.2;
      const awayXG = 1.0;
      
      // Compute with rho = 0 (independent Poisson) vs rho = -0.15
      const gridIndependent = buildScoreGrid(homeXG, awayXG, 0.0);
      const gridCorrected = buildScoreGrid(homeXG, awayXG, -0.15);
      
      // Dixon-Coles with negative rho should increase joint probability of low-scoring draws like 0-0 and 1-1
      // For 1-1: tau = 1 - rho = 1 - (-0.15) = 1.15. Thus corrected probability should be higher.
      expect(gridCorrected[1][1]).toBeGreaterThan(gridIndependent[1][1]);
      
      // For 0-0: tau = 1 - rho * lambda * mu = 1 - (-0.15) * 1.2 * 1.0 = 1 + 0.18 = 1.18.
      expect(gridCorrected[0][0]).toBeGreaterThan(gridIndependent[0][0]);

      // Verify overall grid probability is still 1.0 (due to normalization)
      const sumCorrected = gridCorrected.flat().reduce((a, b) => a + b, 0);
      expect(sumCorrected).toBeCloseTo(1.0, 5);
    });
  });

  // Test 7: Asian Handicap Settlement Calculations (including Quarter Lines, push, splits)
  describe('7. Asian Handicap Quarter/Half/Full Line Settlement', () => {
    it('should resolve full lines correctly (push handling)', () => {
      // Handicap -1.0
      // For score 2-1: (2-1) + (-1.0) = 0.0 -> PUSH
      // For score 3-1: (3-1) + (-1.0) = 1.0 -> WIN
      // For score 1-1: (1-1) + (-1.0) = -1.0 -> LOSS
      const probs = calculateAsianHandicapProbability(1.5, 1.2, -1.0, -0.1);
      
      // Let's verify manually using score grid probabilities
      const grid = buildScoreGrid(1.5, 1.2, -0.1);
      let expectedWin = 0;
      let expectedPush = 0;
      let expectedLoss = 0;
      
      for (let x = 0; x <= 10; x++) {
        for (let y = 0; y <= 10; y++) {
          const dAdj = (x - y) - 1.0;
          if (dAdj >= 0.5) expectedWin += grid[x][y];
          else if (dAdj === 0) expectedPush += grid[x][y];
          else expectedLoss += grid[x][y];
        }
      }
      
      expect(probs.win).toBeCloseTo(expectedWin, 5);
      expect(probs.push).toBeCloseTo(expectedPush, 5);
      expect(probs.loss).toBeCloseTo(expectedLoss, 5);
      expect(probs.cover).toBeCloseTo(expectedWin, 5);
    });

    it('should resolve quarter line -0.25 correctly (split half-loss outcome)', () => {
      // Handicap -0.25
      // For score 1-0: win
      // For score 0-0: (0-0) - 0.25 = -0.25 -> Half Loss
      // For score 0-1: loss
      const probs = calculateAsianHandicapProbability(1.4, 1.1, -0.25, -0.1);
      
      const grid = buildScoreGrid(1.4, 1.1, -0.1);
      let expectedWin = 0;
      let expectedHalfLoss = 0;
      let expectedLoss = 0;
      
      for (let x = 0; x <= 10; x++) {
        for (let y = 0; y <= 10; y++) {
          const dAdj = (x - y) - 0.25;
          if (dAdj >= 0.5) expectedWin += grid[x][y];
          else if (dAdj === -0.25) expectedHalfLoss += grid[x][y];
          else expectedLoss += grid[x][y];
        }
      }
      
      expect(probs.win).toBeCloseTo(expectedWin, 5);
      expect(probs.halfLoss).toBeCloseTo(expectedHalfLoss, 5);
      expect(probs.loss).toBeCloseTo(expectedLoss, 5);
      expect(probs.cover).toBeCloseTo(expectedWin, 5); // cover = win + 0.5 * halfWin = win + 0
    });

    it('should resolve quarter line -0.75 correctly (split half-win outcome)', () => {
      // Handicap -0.75
      // For score 2-0: win
      // For score 1-0: (1-0) - 0.75 = 0.25 -> Half Win
      // For score 0-0: loss
      const probs = calculateAsianHandicapProbability(1.4, 1.1, -0.75, -0.1);
      
      const grid = buildScoreGrid(1.4, 1.1, -0.1);
      let expectedWin = 0;
      let expectedHalfWin = 0;
      let expectedLoss = 0;
      
      for (let x = 0; x <= 10; x++) {
        for (let y = 0; y <= 10; y++) {
          const dAdj = (x - y) - 0.75;
          if (dAdj >= 0.5) expectedWin += grid[x][y];
          else if (dAdj === 0.25) expectedHalfWin += grid[x][y];
          else expectedLoss += grid[x][y];
        }
      }
      
      expect(probs.win).toBeCloseTo(expectedWin, 5);
      expect(probs.halfWin).toBeCloseTo(expectedHalfWin, 5);
      expect(probs.loss).toBeCloseTo(expectedLoss, 5);
      expect(probs.cover).toBeCloseTo(expectedWin + 0.5 * expectedHalfWin, 5);
    });
  });

  // Test explicit parameters (no defaults)
  describe('8. Model Parameter Explicitness', () => {
    it('should require all team strengths and average parameters explicitly', () => {
      const homeStrength = { attack: 1.2, defense: 0.9 };
      const awayStrength = { attack: 1.0, defense: 1.1 };
      const leagueAvgGoals = 2.6;
      
      const xG = calculateExpectedGoals(homeStrength, awayStrength, leagueAvgGoals);
      
      // Home expected goals = 1.2 * 1.1 * 1.3 = 1.716
      // Away expected goals = 1.0 * 0.9 * 1.3 = 1.17
      expect(xG.homeXG).toBeCloseTo(1.716, 4);
      expect(xG.awayXG).toBeCloseTo(1.17, 4);
    });
  });

  // Brier score test
  describe('9. Brier Score Calculations', () => {
    it('should compute correct Brier score for valid inputs', () => {
      const outcomes = [1, 0, 1, 1];
      const probs = [0.8, 0.1, 0.9, 0.5];
      // diffs: 0.2, -0.1, 0.1, 0.5
      // sqDiffs: 0.04, 0.01, 0.01, 0.25 => sum = 0.31 => avg = 0.0775
      const bs = brierScore(outcomes, probs);
      expect(bs).toBeCloseTo(0.0775, 4);
    });
  });
});
