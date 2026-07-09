// Decision Engine Unit Tests
// Location: tests/decision-engine.test.ts

import { describe, it, expect } from 'vitest';
import { DecisionEngine } from '../src/lib/engines/decision-engine';
import { EdgeOutput } from '../src/lib/engines/edge-engine';

describe('DecisionEngine Unit Tests', () => {
  it('should identify a home win edge when bookmaker odds represent value', () => {
    const edge: EdgeOutput = {
      market: 'Moneyline Home',
      bookmaker: 'Pinnacle',
      opening_odds: 1.80,
      current_odds: 2.00,
      closing_odds: 2.00,
      fair_odds: 1.82,
      edge: 5.0,
      EV: 10.0,
      CLV_projection: 10.0,
      steam: false,
      reverse_line: false
    };

    const decision = DecisionEngine.evaluateDecision('fixture-001', edge, 0.95, 0.90);

    expect(decision).not.toBeNull();
    expect(decision.market).toBe('Moneyline Home');
    expect(decision.expectedValue).toBe(10.0);
    expect(decision.decision).toBe('STRONG_VALUE');
    expect(decision.risk).toBe('Low');
  });

  it('should return AVOID when expected value is negative', () => {
    const edge: EdgeOutput = {
      market: 'Moneyline Home',
      bookmaker: 'Pinnacle',
      opening_odds: 1.80,
      current_odds: 1.70,
      closing_odds: 1.70,
      fair_odds: 1.82,
      edge: -3.0,
      EV: -5.0,
      CLV_projection: 0.0,
      steam: false,
      reverse_line: false
    };

    const decision = DecisionEngine.evaluateDecision('fixture-001', edge, 0.85, 0.90);

    expect(decision).not.toBeNull();
    expect(decision.decision).toBe('AVOID');
  });
});
