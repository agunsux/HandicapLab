// Decision Engine Unit Tests
// Location: tests/decision-engine.test.ts

import { describe, it, expect } from 'vitest';
import { DecisionEngine } from '../src/lib/engines/decision-engine';
import { ProbabilityOutput } from '../src/lib/engines/probability-engine/types';

describe('DecisionEngine Unit Tests', () => {
  const engine = new DecisionEngine(0.25); // Quarter-Kelly

  const mockProb: ProbabilityOutput = {
    matchId: 'fixture-001',
    marketType: 'ML',
    pHome: 0.55,
    pDraw: 0.23,
    pAway: 0.22,
    pOver: { '2.5': 0.60 },
    pUnder: { '2.5': 0.40 },
    pAhHome: {},
    pAhAway: {},
    modelVersion: {
      name: 'prematch-v1',
      algo: 'ensemble',
      features: 'basic-v1',
      trainedAt: new Date(),
      trainedOnMatches: 1000
    },
    calibrationApplied: true,
    confidence: {
      modelConfidence: 0.8,
      dataConfidence: 0.8,
      marketConfidence: 0.8,
      finalConfidence: 0.8,
      confidenceScore: 0.8,
      dataQualityScore: 0.9,
      recommendationStatus: 'Recommended',
      reasons: []
    }
  };

  it('should identify a home win edge when bookmaker odds represent value', () => {
    const odds = {
      homeOdds: 2.0, // Implied probability is 50%, model has 55%
      drawOdds: 4.0,
      awayOdds: 4.5
    };

    const decision = engine.calculateDecision('fixture-001', mockProb, odds);

    expect(decision).not.toBeNull();
    expect(decision!.market).toBe('Moneyline Home');
    // EV = 0.55 * 2.0 - 1 = +10%
    expect(decision!.expectedValue).toBe(10.0);
    // Kelly Stake = (EV / (odds - 1)) * 0.25 = (0.10 / 1) * 0.25 = 0.025 (2.5%)
    expect(decision!.recommendedStake).toBe(2.5);
    expect(decision!.risk).toBe('Medium');
  });

  it('should return No Bet when all market options have negative expected value', () => {
    const odds = {
      homeOdds: 1.7, // Implied probability is 58.8% (> 55% model)
      drawOdds: 3.5,
      awayOdds: 3.5
    };

    const decision = engine.calculateDecision('fixture-001', mockProb, odds);

    expect(decision).not.toBeNull();
    expect(decision!.market).toBe('No Bet');
    expect(decision!.expectedValue).toBe(0.0);
    expect(decision!.recommendedStake).toBe(0.0);
  });
});
