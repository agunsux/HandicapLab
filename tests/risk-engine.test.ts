// Risk Engine Unit Tests
// Location: tests/risk-engine.test.ts

import { describe, it, expect } from 'vitest';
import { RiskEngine, RiskBetInput } from '../src/lib/engine/risk-engine';

describe('RiskEngine Correlations and Scaling', () => {
  const bets: RiskBetInput[] = [
    {
      matchId: 'match-1',
      league: 'EPL',
      kickoff: '2026-07-06T15:00:00Z',
      bookmaker: 'Pinnacle',
      weight: 0.10
    },
    {
      // Same match - high correlation
      matchId: 'match-1',
      league: 'EPL',
      kickoff: '2026-07-06T15:00:00Z',
      bookmaker: 'Pinnacle',
      weight: 0.05
    },
    {
      // Different match, same league & kickoff - partial correlation
      matchId: 'match-2',
      league: 'EPL',
      kickoff: '2026-07-06T15:00:00Z',
      bookmaker: 'Bet365',
      weight: 0.08
    }
  ];

  it('should compute correlation parameters accurately', () => {
    expect(RiskEngine.getCorrelation(bets[0], bets[1])).toBe(0.90);
    expect(RiskEngine.getCorrelation(bets[0], bets[2])).toBeCloseTo(0.45, 5); // league (0.3) + kickoff (0.15)
  });

  it('should flag violations of total and segment limits', () => {
    const config = {
      maxExposure: 0.20,
      maxLeagueExposure: 0.12,
      maxBookmakerExposure: 0.12
    };

    // Total = 0.23 (exceeds 0.20), League EPL = 0.23 (exceeds 0.12), Bookmaker Pinnacle = 0.15 (exceeds 0.12)
    const result = RiskEngine.evaluateRisk(bets, config);

    expect(result.valid).toBe(false);
    expect(result.violations.length).toBe(3);
    expect(result.riskScore).toBeGreaterThan(0);
  });

  it('should scale allocations proportionally to satisfy constraints', () => {
    const config = {
      maxExposure: 0.15,
      maxLeagueExposure: 0.10,
      maxBookmakerExposure: 0.10
    };

    const scaled = RiskEngine.scaleToLimits(bets, config);
    const result = RiskEngine.evaluateRisk(scaled, config);

    expect(result.valid).toBe(true);
    expect(result.totalExposure).toBeLessThanOrEqual(config.maxExposure);
  });
});
