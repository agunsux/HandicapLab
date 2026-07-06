// HandicapLab Market Intelligence - Leakage Guard Test
// Location: tests/market-intelligence/leakage-guard.test.ts

import { describe, it, expect } from 'vitest';
import { OddsTimeline } from '../../src/lib/market-intelligence/types';
import { CLVEvaluator } from '../../src/lib/market-intelligence/features/evaluation/clv';

describe('Market Intelligence Leakage Guard Tests', () => {
  const mockTimeline: OddsTimeline = {
    matchId: 'test-match-1',
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
      },
      {
        timestamp: new Date('2026-07-06T18:00:00Z'),
        moneyline: { home: 1.95, draw: 3.40, away: 3.80 }
      }
    ]
  };

  it('should throw an error if closing odds are accessed before kickoff (prematch prediction)', () => {
    expect(() => {
      CLVEvaluator.evaluateCLV(mockTimeline, 1.95, 'home');
    }).toThrow("Closing line not available. Cannot evaluate CLV.");
  });

  it('should calculate CLV successfully when closing odds are present', () => {
    const postMatchTimeline: OddsTimeline = {
      ...mockTimeline,
      closing: {
        timestamp: new Date('2026-07-06T19:00:00Z'),
        moneyline: { home: 1.90, draw: 3.50, away: 4.00 }
      }
    };

    const clv = CLVEvaluator.evaluateCLV(postMatchTimeline, 1.95, 'home');
    expect(clv.rawCLV).toBeCloseTo(0.0263, 4); // (1.95 / 1.90) - 1 = 0.026315
    expect(clv.logCLV).toBeCloseTo(Math.log(1.95 / 1.90), 4);
  });
});
