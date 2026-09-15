/**
 * Model A Unit & Forensic Tests: Hierarchical Dixon-Coles Asian Handicap Baseline
 * Location: tests/research-ah/model-a.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  HierarchicalDixonColesModel,
  dixonColesTau,
  poissonPdf,
} from '../../src/lib/research/model-a/hierarchicalDixonColes';
import { AhProbabilityEngine } from '../../src/lib/research/model-a/ahProbabilityEngine';
import { CanonicalMatch } from '../../src/lib/research/model-a/types';

describe('Model A: Hierarchical Dixon-Coles Baseline', () => {
  describe('1. Score Matrix & Probability Invariants', () => {
    it('generates a bivariate score matrix that sums to 1.0 within numerical precision', () => {
      const dist = HierarchicalDixonColesModel.computeScoreDistribution(1.75, 1.15, -0.05, 10);
      let sum = 0;
      for (let h = 0; h <= dist.maxGoals; h++) {
        for (let a = 0; a <= dist.maxGoals; a++) {
          sum += dist.matrix[h][a];
        }
      }
      expect(sum).toBeCloseTo(1.0, 6);
    });

    it('ensures all cell probabilities in the score matrix are strictly non-negative', () => {
      const dist = HierarchicalDixonColesModel.computeScoreDistribution(1.5, 1.2, -0.15, 10);
      for (let h = 0; h <= dist.maxGoals; h++) {
        for (let a = 0; a <= dist.maxGoals; a++) {
          expect(dist.matrix[h][a]).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('correctly maps score matrix to 1X2 match probabilities summing to 1.0', () => {
      const dist = HierarchicalDixonColesModel.computeScoreDistribution(1.8, 0.9, -0.05, 10);
      const { pHomeWin, pDraw, pAwayWin } =
        HierarchicalDixonColesModel.matrixToOutcomeProbabilities(dist);

      expect(pHomeWin).toBeGreaterThan(pAwayWin);
      expect(pHomeWin + pDraw + pAwayWin).toBeCloseTo(1.0, 3);
    });
  });

  describe('2. Dixon-Coles Low-Score Correction (Tau)', () => {
    it('applies correct tau factors for 0-0, 1-0, 0-1, and 1-1', () => {
      const lh = 1.6;
      const la = 1.0;
      const rho = -0.10;

      // tau(0,0) = 1 - lh * la * rho = 1 - 1.6 * 1.0 * (-0.10) = 1 + 0.16 = 1.16
      expect(dixonColesTau(0, 0, lh, la, rho)).toBeCloseTo(1.16, 4);

      // tau(1,0) = 1 + la * rho = 1 + 1.0 * (-0.10) = 0.90
      expect(dixonColesTau(1, 0, lh, la, rho)).toBeCloseTo(0.90, 4);

      // tau(0,1) = 1 + lh * rho = 1 + 1.6 * (-0.10) = 0.84
      expect(dixonColesTau(0, 1, lh, la, rho)).toBeCloseTo(0.84, 4);

      // tau(1,1) = 1 - rho = 1 - (-0.10) = 1.10
      expect(dixonColesTau(1, 1, lh, la, rho)).toBeCloseTo(1.10, 4);
    });

    it('leaves tau = 1.0 for any score line above 1 goal', () => {
      const lh = 1.6;
      const la = 1.0;
      const rho = -0.10;

      expect(dixonColesTau(2, 0, lh, la, rho)).toBe(1.0);
      expect(dixonColesTau(2, 1, lh, la, rho)).toBe(1.0);
      expect(dixonColesTau(0, 2, lh, la, rho)).toBe(1.0);
      expect(dixonColesTau(3, 3, lh, la, rho)).toBe(1.0);
    });
  });

  describe('3. Temporal Causality & Anti-Leakage Invariants', () => {
    it('throws a hard anti-leakage error if a match date >= referenceDate is passed to fitLeague', () => {
      const mockMatches: CanonicalMatch[] = [
        {
          canonicalId: 'ENG-PL|2022-01-01|arsenal|chelsea',
          leagueId: 'ENG-PL',
          season: '2021-2022',
          matchDate: '2022-01-01',
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          homeGoals: 2,
          awayGoals: 1,
        },
        {
          canonicalId: 'ENG-PL|2022-08-15|arsenal|chelsea', // Future match!
          leagueId: 'ENG-PL',
          season: '2022-2023',
          matchDate: '2022-08-15',
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          homeGoals: 0,
          awayGoals: 2,
        },
      ];

      expect(() => {
        HierarchicalDixonColesModel.fitLeague(mockMatches, 'ENG-PL', '2022-08-01');
      }).toThrow(/ANTI-LEAKAGE VIOLATION/);
    });

    it('estimates parameters strictly using past matches when causality is respected', () => {
      const mockMatches: CanonicalMatch[] = [];
      const teams = ['Arsenal', 'Chelsea', 'Liverpool', 'Man City'];
      // Generate 40 synthetic historical matches
      for (let i = 0; i < 40; i++) {
        const h = teams[i % 4];
        const a = teams[(i + 1) % 4];
        mockMatches.push({
          canonicalId: `ENG-PL|2021-10-${(i % 25) + 1}|${h}|${a}`,
          leagueId: 'ENG-PL',
          season: '2021-2022',
          matchDate: `2021-10-${String((i % 25) + 1).padStart(2, '0')}`,
          homeTeam: h,
          awayTeam: a,
          homeGoals: (i % 3) + 1,
          awayGoals: i % 2,
        });
      }

      const model = HierarchicalDixonColesModel.fitLeague(mockMatches, 'ENG-PL', '2021-11-01');
      expect(model.nMatches).toBe(40);
      expect(model.nTeams).toBe(4);
      expect(model.gamma).toBeGreaterThanOrEqual(0.02);
      expect(model.mu).toBeDefined();
    });
  });

  describe('4. Asian Handicap Settlement Probabilities & Symmetry', () => {
    it('maintains exact payout and probability symmetry between Home (Line L) and Away (-L)', () => {
      const dist = HierarchicalDixonColesModel.computeScoreDistribution(1.6, 1.2, -0.05);

      for (const line of [-1.5, -1.25, -1.0, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5]) {
        const sym = AhProbabilityEngine.verifySymmetry(dist, line);
        expect(sym.symmetric).toBe(true);
        expect(sym.maxDiscrepancy).toBeLessThan(1e-3);
      }
    });

    it('correctly models quarter lines with Half Win and Half Loss', () => {
      const dist = HierarchicalDixonColesModel.computeScoreDistribution(1.8, 1.0, -0.05);

      // On line -0.75, winning by exactly 1 goal is a HALF_WIN
      const probs75 = AhProbabilityEngine.computeAhLineProbabilities(dist, -0.75, 1.95, 'HOME');
      expect(probs75.pHalfWin).toBeGreaterThan(0);
      expect(probs75.pWin).toBeGreaterThan(0);
      expect(probs75.pLoss).toBeGreaterThan(0);
      expect(probs75.pWin + probs75.pHalfWin + probs75.pPush + probs75.pHalfLoss + probs75.pLoss).toBeCloseTo(1.0, 3);

      // On line -0.25, drawing (goal diff 0) is a HALF_LOSS
      const probs25 = AhProbabilityEngine.computeAhLineProbabilities(dist, -0.25, 1.95, 'HOME');
      expect(probs25.pHalfLoss).toBeGreaterThan(0);
      expect(probs25.pWin).toBeGreaterThan(0);
      expect(probs25.pLoss).toBeGreaterThan(0);
      expect(probs25.pWin + probs25.pHalfWin + probs25.pPush + probs25.pHalfLoss + probs25.pLoss).toBeCloseTo(1.0, 3);
    });

    it('computes fair decimal price consistent with zero EV', () => {
      const dist = HierarchicalDixonColesModel.computeScoreDistribution(1.5, 1.1, -0.05);
      const res = AhProbabilityEngine.computeAhLineProbabilities(dist, -0.5, 1.95, 'HOME');

      expect(res.fairOdds).toBeGreaterThan(1.0);
      // If we re-evaluate at fairOdds, EV should be approximately 0.0
      if (res.fairOdds) {
        const reEval = AhProbabilityEngine.computeAhLineProbabilities(dist, -0.5, res.fairOdds, 'HOME');
        expect(Math.abs(reEval.ev)).toBeLessThan(0.02);
      }
    });
  });

  describe('5. Goal Difference Distribution', () => {
    it('derives a discrete GD PMF with expected GD matching homeLambda - awayLambda', () => {
      const lh = 2.0;
      const la = 1.0;
      const dist = HierarchicalDixonColesModel.computeScoreDistribution(lh, la, -0.05);
      const gd = AhProbabilityEngine.scoreDistributionToGoalDifferencePmf(dist);

      let totalP = 0;
      for (const p of Object.values(gd.pmf)) totalP += p;
      expect(totalP).toBeCloseTo(1.0, 4);

      // In Poisson/Dixon-Coles, E[H - A] is approximately lh - la = 1.0
      expect(gd.expectedGd).toBeCloseTo(lh - la, 1);
    });
  });
});

