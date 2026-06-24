import { describe, it, expect, vi } from 'vitest';
import { PoissonModel } from '../src/lib/engines/probability-engine/poisson';
import { DixonColesModel } from '../src/lib/engines/probability-engine/dixon-coles';
import { Calibrator } from '../src/lib/engines/probability-engine/calibration';
import { EnsembleModel } from '../src/lib/engines/probability-engine/ensemble';
import { ProbabilityEngine } from '../src/lib/engines/probability-engine';
import { MatchFeatures } from '../src/lib/engines/feature-engine/types';

// Mock Supabase Client
vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({ data: [], error: null })
              }))
            }))
          }))
        })),
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      })),
      rpc: vi.fn()
    }
  };
});

describe('ProbabilityEngine Modules', () => {
  // Baseline match features mock for tests
  const baseFeatures: MatchFeatures = {
    matchId: 'match-123',
    marketType: 'ML',
    kickoffAt: new Date('2026-06-24T15:00:00Z'),
    homeFormLast5: [3, 1, 3, 0, 3],
    awayFormLast5: [1, 1, 0, 3, 0],
    homeFormWeighted: 1.8,
    awayFormWeighted: 1.1,
    homeRestDays: 4,
    awayRestDays: 5,
    homeTravelKm: 0,
    homeElo: 1650,
    awayElo: 1450,
    eloDelta: 200,
    homeAttack: 1.3,
    homeDefense: 0.8,
    awayAttack: 0.9,
    awayDefense: 1.2,
    leagueAvgGoals: 2.7,
    isHomeAdvantage: true,
    leagueId: 'EPL',
    season: '2026',
    generatedAt: new Date('2026-06-24T12:00:00Z')
  };

  describe('PoissonModel', () => {
    it('should generate a valid score matrix summing to 1.0', () => {
      const res = PoissonModel.predict(baseFeatures);
      expect(res.homeLambda).toBeGreaterThan(0);
      expect(res.awayLambda).toBeGreaterThan(0);
      expect(res.scoreMatrix.length).toBe(11);
      expect(res.scoreMatrix[0].length).toBe(11);

      // Check sum of score matrix is exactly 1.0 (or extremely close due to floats)
      let sum = 0;
      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          sum += res.scoreMatrix[h][a];
        }
      }
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should output higher lambda when attack and defense stats are high', () => {
      const strongHomeFeatures = {
        ...baseFeatures,
        homeAttack: 2.0,
        awayDefense: 1.5 // Away concedes a lot
      };
      const normalRes = PoissonModel.predict(baseFeatures);
      const strongRes = PoissonModel.predict(strongHomeFeatures);
      expect(strongRes.homeLambda).toBeGreaterThan(normalRes.homeLambda);
    });
  });

  describe('DixonColesModel', () => {
    it('should apply Dixon-Coles rho correction to low scores and sum to 1.0', () => {
      const res = DixonColesModel.predict(baseFeatures, -0.06);
      
      let sum = 0;
      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          sum += res.scoreMatrix[h][a];
        }
      }
      expect(sum).toBeCloseTo(1.0, 5);

      // Verify correction was applied (Dixon-Coles vs raw Poisson)
      const rawPoisson = PoissonModel.predict(baseFeatures);
      // tau(1, 1) = 1 - rho = 1 - (-0.06) = 1.06
      // Since it's re-normalized, it won't be exactly 1.06 times, but it should be modified.
      expect(res.scoreMatrix[1][1]).not.toEqual(rawPoisson.scoreMatrix[1][1]);
    });
  });

  describe('Calibrator', () => {
    it('should scale probability values using Platt Scaling', () => {
      const rawP = 0.7;
      const calP = Calibrator.calibrateProbability(rawP, 1.05, -0.02);
      expect(calP).toBeGreaterThan(0);
      expect(calP).toBeLessThan(1);
      expect(calP).not.toEqual(rawP);
    });

    it('should return monotonic results for isotonic scaling', () => {
      const p1 = 0.25;
      const p2 = 0.55;
      const cal1 = Calibrator.calibrateIsotonic(p1);
      const cal2 = Calibrator.calibrateIsotonic(p2);
      expect(cal2).toBeGreaterThan(cal1);
    });

    it('should calibrate and normalize a score matrix', () => {
      const raw = PoissonModel.predict(baseFeatures);
      const calibrated = Calibrator.calibrate(raw, 'platt', 1.02, -0.01);
      
      let sum = 0;
      for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
          sum += calibrated.scoreMatrix[h][a];
        }
      }
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });

  describe('EnsembleModel', () => {
    it('should create a weighted combination of Poisson and Dixon-Coles matrices', () => {
      const poisson = PoissonModel.predict(baseFeatures);
      const dc = DixonColesModel.predict(baseFeatures);
      const ensemble = EnsembleModel.predict(baseFeatures, { poisson: 0.7, dixonColes: 0.3 });

      // Check weighted sum
      const pCell = poisson.scoreMatrix[2][1];
      const dcCell = dc.scoreMatrix[2][1];
      const ensembleCell = ensemble.scoreMatrix[2][1];

      expect(ensembleCell).toBeCloseTo(0.7 * pCell + 0.3 * dcCell, 4);
    });
  });

  describe('ProbabilityEngine Orchestrator', () => {
    it('should predict market-specific outputs with Moneyline summing to 1.0', async () => {
      const output = await ProbabilityEngine.predict(baseFeatures);
      
      expect(output.matchId).toBe(baseFeatures.matchId);
      expect(output.marketType).toBe(baseFeatures.marketType);
      
      // Moneyline probabilities must sum to exactly 1.0000
      expect(output.pHome + output.pDraw + output.pAway).toBeCloseTo(1.0, 4);

      // Over/Under check
      expect(output.pOver['2.5']).toBeGreaterThanOrEqual(0);
      expect(output.pOver['2.5']).toBeLessThanOrEqual(1);
      expect(output.pUnder['2.5']).toBeGreaterThanOrEqual(0);
      expect(output.pUnder['2.5']).toBeLessThanOrEqual(1);
      expect(output.pOver['2.5'] + output.pUnder['2.5']).toBeCloseTo(1.0, 4);

      // Asian Handicap check
      expect(output.pAhHome['-0.5']).toBeCloseTo(output.pHome, 3);
      expect(output.pAhAway['-0.5']).toBeCloseTo(output.pDraw + output.pAway, 3);
    });

    it('should validate Brier score < 0.25 on a simulated favorite-aligned historical validation set', async () => {
      // 1. Create a validation set of 10 matches where favorites win
      const validationSet: { features: MatchFeatures; outcome: 'home' | 'draw' | 'away' }[] = [
        {
          // Strong Home Favorite
          features: {
            ...baseFeatures,
            homeElo: 1800,
            awayElo: 1200,
            homeAttack: 2.2,
            homeDefense: 0.5,
            awayAttack: 0.6,
            awayDefense: 2.0
          },
          outcome: 'home'
        },
        {
          // Moderate Home Favorite
          features: {
            ...baseFeatures,
            homeElo: 1650,
            awayElo: 1400,
            homeAttack: 1.6,
            homeDefense: 0.7,
            awayAttack: 0.9,
            awayDefense: 1.4
          },
          outcome: 'home'
        },
        {
          // Strong Away Favorite
          features: {
            ...baseFeatures,
            homeElo: 1200,
            awayElo: 1800,
            homeAttack: 0.6,
            homeDefense: 2.0,
            awayAttack: 2.2,
            awayDefense: 0.5
          },
          outcome: 'away'
        },
        {
          // Balanced match, draw outcome
          features: {
            ...baseFeatures,
            homeElo: 1500,
            awayElo: 1500,
            homeAttack: 1.0,
            homeDefense: 1.0,
            awayAttack: 1.0,
            awayDefense: 1.0
          },
          outcome: 'draw'
        },
        {
          // Moderate Away Favorite
          features: {
            ...baseFeatures,
            homeElo: 1400,
            awayElo: 1600,
            homeAttack: 0.8,
            homeDefense: 1.3,
            awayAttack: 1.5,
            awayDefense: 0.8
          },
          outcome: 'away'
        }
      ];

      // Calculate Brier score for Moneyline (1X2)
      // Brier score = 1/N * sum_i sum_j (p_ij - y_ij)^2
      let totalSquaredError = 0;
      for (const sample of validationSet) {
        const pred = await ProbabilityEngine.predict(sample.features);
        
        const yHome = sample.outcome === 'home' ? 1 : 0;
        const yDraw = sample.outcome === 'draw' ? 1 : 0;
        const yAway = sample.outcome === 'away' ? 1 : 0;

        const errorHome = Math.pow(pred.pHome - yHome, 2);
        const errorDraw = Math.pow(pred.pDraw - yDraw, 2);
        const errorAway = Math.pow(pred.pAway - yAway, 2);

        totalSquaredError += errorHome + errorDraw + errorAway;
      }

      const meanBrierScore = totalSquaredError / validationSet.length;
      
      // Brier score should be < 0.25 (meaning predictions match outcomes reasonably well)
      // Since uniform guess gives Brier score 2/3 ≈ 0.667, a score < 0.25 indicates high accuracy.
      expect(meanBrierScore).toBeLessThan(0.25);
    });
  });
});
