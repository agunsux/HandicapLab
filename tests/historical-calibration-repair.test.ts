import { describe, it, expect } from 'vitest';
import { computeLambdas, deriveMarkets, scoreMatrix, poissonPmf, type PoissonParams, type LambdaInput } from '../src/historical/model/poisson';
import {
  fitBinaryTemperature,
  applyBinaryTemperature,
  fitBinaryPlatt,
  applyBinaryPlatt,
  fitSoftmaxTemperature,
  applySoftmaxTemperature,
} from '../src/historical/model/calibrate';
import { calibrationBuckets, brierAndLogLoss, roiWithCI, winRateWithCI } from '../src/historical/model/metrics';

describe('Historical Calibration & Model Repair Tests', () => {
  describe('1. Poisson Model Mathematical Correctness & Bounds', () => {
    const params: PoissonParams = {
      leagueHomeAvg: 1.5,
      leagueAwayAvg: 1.2,
      homeAdv: 1.25,
      eloScale: 400,
      maxGoals: 10,
    };

    it('should compute realistic lambdas without double-dividing by league average', () => {
      const input: LambdaInput = {
        homeAvgGoalsFor: 1.5,
        awayAvgGoalsAgainst: 1.5,
        awayAvgGoalsFor: 1.2,
        homeAvgGoalsAgainst: 1.2,
        leagueAvgGoals: 2.7,
        eloDelta: 0,
      };

      const lambdas = computeLambdas(input, params);
      // For average teams, expected goals should match base league averages
      expect(lambdas.home).toBeCloseTo(1.5, 1);
      expect(lambdas.away).toBeCloseTo(1.2, 1);
    });

    it('should scale lambdas smoothly with Elo delta', () => {
      const inputHighElo: LambdaInput = {
        homeAvgGoalsFor: 2.0,
        awayAvgGoalsAgainst: 1.2,
        awayAvgGoalsFor: 0.9,
        homeAvgGoalsAgainst: 1.0,
        leagueAvgGoals: 2.7,
        eloDelta: 200,
      };

      const inputLowElo: LambdaInput = {
        ...inputHighElo,
        eloDelta: -200,
      };

      const high = computeLambdas(inputHighElo, params);
      const low = computeLambdas(inputLowElo, params);

      expect(high.home).toBeGreaterThan(low.home);
      expect(high.away).toBeLessThan(low.away);
      expect(high.home).toBeLessThanOrEqual(5.0);
      expect(high.away).toBeGreaterThanOrEqual(0.1);
    });

    it('should generate valid score matrix summing to 1.0', () => {
      const lambdas = { home: 1.6, away: 1.1 };
      const matrix = scoreMatrix(lambdas, 10);
      let sum = 0;
      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          sum += matrix[h][a];
        }
      }
      expect(sum).toBeCloseTo(1.0, 3);
    });

    it('should derive market probabilities that satisfy all normalization constraints', () => {
      const matrix = scoreMatrix({ home: 1.7, away: 1.2 }, 10);
      const markets = deriveMarkets(matrix);

      // P(Home) + P(Draw) + P(Away) = 1.0
      expect(markets.pHome + markets.pDraw + markets.pAway).toBeCloseTo(1.0, 5);

      // Probabilities between 0 and 1
      expect(markets.pHome).toBeGreaterThanOrEqual(0);
      expect(markets.pHome).toBeLessThanOrEqual(1);
      expect(markets.pDraw).toBeGreaterThanOrEqual(0);
      expect(markets.pDraw).toBeLessThanOrEqual(1);
      expect(markets.pAway).toBeGreaterThanOrEqual(0);
      expect(markets.pAway).toBeLessThanOrEqual(1);

      // Over/Under 2.5 sum to 1.0
      expect(markets.pOver['2.5'] + markets.pUnder['2.5']).toBeCloseTo(1.0, 5);

      // Over 2.5 should be realistic (~45-65% for typical match)
      expect(markets.pOver['2.5']).toBeGreaterThan(0.35);
      expect(markets.pOver['2.5']).toBeLessThan(0.75);
    });
  });

  describe('2. Probability Calibration Integrity & Boundary Behavior', () => {
    it('should fit softmax temperature scaling without boundary collapse on realistic overconfident data', () => {
      // Overconfident predictions with typical sports outcome noise
      const dists = [
        { pHome: 0.75, pDraw: 0.15, pAway: 0.10 },
        { pHome: 0.65, pDraw: 0.20, pAway: 0.15 },
        { pHome: 0.60, pDraw: 0.25, pAway: 0.15 },
        { pHome: 0.20, pDraw: 0.30, pAway: 0.50 },
        { pHome: 0.15, pDraw: 0.25, pAway: 0.60 },
        { pHome: 0.40, pDraw: 0.35, pAway: 0.25 },
        { pHome: 0.70, pDraw: 0.20, pAway: 0.10 },
        { pHome: 0.30, pDraw: 0.40, pAway: 0.30 },
      ];
      // Mixed outcomes with some upsets & draws
      const outcomes: Array<'H' | 'D' | 'A'> = ['H', 'D', 'H', 'A', 'H', 'D', 'D', 'A'];

      const fit = fitSoftmaxTemperature(dists, outcomes, ['2020-2021', '2021-2022']);
      expect(fit.at_boundary).toBe(false);
      expect(fit.T).toBeGreaterThan(0.5);
      expect(fit.T).toBeLessThan(3.5);
    });

    it('should apply softmax temperature scaling preserving sum = 1.0', () => {
      const raw = { pHome: 0.7, pDraw: 0.2, pAway: 0.1 };
      const cal = applySoftmaxTemperature(raw, 1.5);
      expect(cal.pHome + cal.pDraw + cal.pAway).toBeCloseTo(1.0, 5);
      expect(cal.pHome).toBeGreaterThan(0);
      expect(cal.pDraw).toBeGreaterThan(0);
      expect(cal.pAway).toBeGreaterThan(0);
      // Softened from raw
      expect(cal.pHome).toBeLessThan(raw.pHome);
      expect(cal.pDraw).toBeGreaterThan(raw.pDraw);
    });

    it('should fit binary Platt scaling without crashing and produce bounded probabilities', () => {
      const probs = [0.45, 0.52, 0.58, 0.62, 0.70, 0.35, 0.40, 0.65];
      const outcomes = [false, true, true, true, true, false, false, true];

      const fit = fitBinaryPlatt(probs, outcomes, ['train']);
      expect(fit.a).toBeGreaterThan(0);
      expect(isFinite(fit.b)).toBe(true);

      const pCal = applyBinaryPlatt(0.60, fit.a, fit.b);
      expect(pCal).toBeGreaterThan(0);
      expect(pCal).toBeLessThan(1);
    });

    it('should produce deterministic output for identical inputs', () => {
      const dist = { pHome: 0.45, pDraw: 0.30, pAway: 0.25 };
      const res1 = applySoftmaxTemperature(dist, 1.6);
      const res2 = applySoftmaxTemperature(dist, 1.6);
      expect(res1).toEqual(res2);
    });
  });

  describe('3. Metrics & Calibration Error Evaluation', () => {
    it('should calculate 10-bin ECE covering full [0, 1] range', () => {
      const preds = [
        { p: 0.15, outcome: false },
        { p: 0.25, outcome: false },
        { p: 0.35, outcome: true },
        { p: 0.55, outcome: true },
        { p: 0.75, outcome: true },
        { p: 0.85, outcome: true },
      ];

      const result = calibrationBuckets(preds);
      expect(result.buckets.length).toBe(12);
      expect(result.ece).toBeGreaterThanOrEqual(0);
      expect(result.ece).toBeLessThanOrEqual(1.0);
    });

    it('should compute multiclass Brier score and LogLoss correctly', () => {
      const preds = [
        { pHome: 1.0, pDraw: 0.0, pAway: 0.0 },
        { pHome: 0.0, pDraw: 1.0, pAway: 0.0 },
      ];
      const outcomes: Array<'H' | 'D' | 'A'> = ['H', 'D'];

      const res = brierAndLogLoss(preds, outcomes);
      expect(res).not.toBeNull();
      expect(res!.brier).toBeCloseTo(0.0, 4);
      expect(res!.logloss).toBeLessThan(0.001);
    });
  });
});
