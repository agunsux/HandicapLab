import { describe, it, expect } from 'vitest';
import { ValueDetector } from '../src/lib/engines/edge-scanner/value-detector';
import { Kelly } from '../src/lib/engines/edge-scanner/kelly';
import { ClvTracker } from '../src/lib/engines/edge-scanner/clv-tracker';
import { ConfidenceScanner } from '../src/lib/engines/edge-scanner/confidence';
import { EdgeScanner } from '../src/lib/engines/edge-scanner';
import { ProbabilityOutput } from '../src/lib/engines/probability-engine/types';

describe('EdgeScanner Modules', () => {
  describe('ValueDetector', () => {
    it('should calculate expected value and implied probability correctly', () => {
      const p = 0.60;
      const odds = 2.0; // Implied = 0.50, EV = 0.6 * 2 - 1 = 0.20
      const res = ValueDetector.calculateEdge(p, odds);

      expect(res.impliedProbability).toBe(0.50);
      expect(res.expectedValue).toBe(0.20);
      expect(res.edge).toBe(0.10);
      expect(ValueDetector.isValue(res.expectedValue)).toBe(true);
    });

    it('should return false for isValue if EV is less than threshold', () => {
      const res = ValueDetector.calculateEdge(0.40, 2.0); // EV = -0.20
      expect(ValueDetector.isValue(res.expectedValue)).toBe(false);
    });
  });

  describe('Kelly Criterion', () => {
    it('should compute correct Kelly stake when edge is positive', () => {
      // p = 0.55, odds = 2.0. EV = 0.55 * 2.0 - 1 = 0.10.
      // Net odds b = 2.0 - 1 = 1.0.
      // Raw Kelly = 0.10 / 1.0 = 0.10.
      // Fractional Kelly (0.25) = 0.25 * 0.10 = 0.025.
      const stake = Kelly.calculateStake(0.55, 2.0);
      expect(stake).toBe(0.025);
    });

    it('should return 0 stake if EV is negative', () => {
      const stake = Kelly.calculateStake(0.40, 2.0);
      expect(stake).toBe(0);
    });

    it('should clamp Kelly stake to maxStake', () => {
      // p = 0.90, odds = 2.0. EV = 0.80.
      // Raw Kelly = 0.80 / 1.0 = 0.80.
      // Fractional Kelly (0.25) = 0.20.
      // Clamped to maxStake (default 0.10).
      const stake = Kelly.calculateStake(0.90, 2.0);
      expect(stake).toBe(0.10);
    });
  });

  describe('ClvTracker', () => {
    it('should calculate CLV correctly when closing odds are lower than bet odds', () => {
      const betOdds = 2.0;
      const closingOdds = 1.80; // CLV = (1.80 / 2.0) - 1 = -0.10
      const clv = ClvTracker.calculateClv(betOdds, closingOdds);
      expect(clv).toBeCloseTo(-0.10, 4);
    });

    it('should return null if closing odds are invalid or missing', () => {
      expect(ClvTracker.calculateClv(2.0, null)).toBeNull();
      expect(ClvTracker.calculateClv(2.0, 0)).toBeNull();
      expect(ClvTracker.calculateClv(2.0, 0.9)).toBeNull();
    });
  });

  describe('ConfidenceScanner', () => {
    it('should assign correct confidence level based on probability', () => {
      expect(ConfidenceScanner.getConfidence(0.75)).toBe('HIGH');
      expect(ConfidenceScanner.getConfidence(0.60)).toBe('MEDIUM');
      expect(ConfidenceScanner.getConfidence(0.45)).toBe('LOW');
    });
  });

  describe('EdgeScanner Orchestrator', () => {
    const mockModelOutput: ProbabilityOutput = {
      matchId: 'match-123',
      marketType: 'ML',
      pHome: 0.60,
      pDraw: 0.25,
      pAway: 0.15,
      pOver: { '2.5': 0.65, '1.5': 0.80 },
      pUnder: { '2.5': 0.35, '1.5': 0.20 },
      pAhHome: { '-0.5': 0.60, '-1.0': 0.40 },
      pAhAway: { '-0.5': 0.40, '-1.0': 0.60 },
      modelVersion: {
        name: 'prematch-v1',
        algo: 'dixon-coles-poisson-ensemble',
        features: 'basic-v1',
        trainedAt: new Date(),
        trainedOnMatches: 1000
      },
      calibrationApplied: true
    };

    it('should scan ML and identify positive EV selections, sorting by EV descending', () => {
      // Home odds = 2.0 (EV = 0.60 * 2 - 1 = 0.20)
      // Draw odds = 3.0 (EV = 0.25 * 3 - 1 = -0.25)
      // Away odds = 8.0 (EV = 0.15 * 8 - 1 = 0.20)
      // Both Home and Away have positive EV = 0.20. Let's make Home EV higher to test sorting:
      // Home odds = 2.10 (EV = 0.60 * 2.1 - 1 = 0.26)
      const odds = {
        homeOdds: 2.10,
        drawOdds: 3.0,
        awayOdds: 8.0
      };

      const picks = EdgeScanner.scan('match-123', 'ML', mockModelOutput, odds);

      expect(picks.length).toBe(2);
      expect(picks[0].outcome).toBe('home'); // Sorted by EV descending (0.26 vs 0.20)
      expect(picks[0].expectedValue).toBe(0.26);
      expect(picks[0].tier).toBe('ELITE'); // EV >= 0.15 is ELITE
      
      expect(picks[1].outcome).toBe('away');
      expect(picks[1].expectedValue).toBe(0.20);
      expect(picks[1].tier).toBe('ELITE');
    });

    it('should scan Over/Under for a specific line', () => {
      // Line = 2.5
      // Over probability = 0.65. Over odds = 1.80 (EV = 0.65 * 1.8 - 1 = 0.17)
      // Under probability = 0.35. Under odds = 2.10 (EV = 0.35 * 2.1 - 1 = -0.265)
      const odds = {
        line: 2.5,
        homeOdds: 1.80, // Over
        awayOdds: 2.10  // Under
      };

      const picks = EdgeScanner.scan('match-123', 'OU', mockModelOutput, odds);

      expect(picks.length).toBe(1);
      expect(picks[0].outcome).toBe('over');
      expect(picks[0].expectedValue).toBe(0.17);
      expect(picks[0].line).toBe('2.5');
    });

    it('should scan Asian Handicap and calculate CLV if closing odds are provided', () => {
      // Line = -1.0
      // pAhHome['-1.0'] = 0.40, odds = 3.0 (EV = 0.20)
      // Closing odds = 2.50. CLV = (3.0 / 2.50) - 1 = 0.20
      const odds = {
        line: -1.0,
        homeOdds: 3.0,
        awayOdds: 1.5
      };

      const closingOdds = {
        line: -1.0,
        homeOdds: 2.50,
        awayOdds: 1.6
      };

      const picks = EdgeScanner.scan('match-123', 'AH', mockModelOutput, odds, closingOdds);

      expect(picks.length).toBe(1);
      expect(picks[0].outcome).toBe('home');
      expect(picks[0].expectedValue).toBe(0.20);
      expect(picks[0].clv).toBe(-0.1667);
      expect(picks[0].line).toBe('-1.0');
    });
  });
});
