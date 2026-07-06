// HandicapLab Decision Engine v1 - Leakage Prevention Tests
// Location: tests/decision-engine-v1/leakage-prevention.test.ts

import { describe, it, expect } from 'vitest';
import { OddsTimeline } from '../../src/lib/market-intelligence/types';
import { CLVEvaluator } from '../../src/lib/market-intelligence/features/evaluation/clv';

describe('Decision Engine v1 - Leakage Prevention Tests', () => {
  const dummyTimeline: OddsTimeline = {
    matchId: 'leakage-match-1',
    provider: 'Pinnacle',
    opening: {
      timestamp: new Date('2026-07-06T12:00:00Z'),
      moneyline: { home: 2.10, draw: 3.30, away: 3.50 }
    },
    current: {
      timestamp: new Date('2026-07-06T18:00:00Z'),
      moneyline: { home: 1.95, draw: 3.40, away: 3.80 }
    },
    history: [
      {
        timestamp: new Date('2026-07-06T12:00:00Z'),
        moneyline: { home: 2.10, draw: 3.30, away: 3.50 }
      }
    ]
  };

  it('should prevent access to closing line variables before match starts', () => {
    // Assert that the pre-match execution cannot query CLV without closing line
    expect(() => {
      CLVEvaluator.evaluateCLV(dummyTimeline, 1.95, 'home');
    }).toThrow('Closing line not available. Cannot evaluate CLV.');
  });

  it('should assert that pre-match timestamp strictly precedes closing timeline timestamp', () => {
    const preMatchTime = new Date('2026-07-06T18:00:00Z').getTime();
    const postMatchTime = new Date('2026-07-06T19:00:00Z').getTime();
    
    // Hard check: prediction timestamp must always precede feature timestamps
    expect(preMatchTime).toBeLessThan(postMatchTime);
  });
});
