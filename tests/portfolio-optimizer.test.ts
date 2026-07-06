// Portfolio Optimizer Unit Tests
// Location: tests/portfolio-optimizer.test.ts

import { describe, it, expect } from 'vitest';
import { PortfolioOptimizer, CandidateEdge } from '../src/lib/engine/portfolio-optimizer';

describe('PortfolioOptimizer Staking Models', () => {
  const mockCandidates: CandidateEdge[] = [
    {
      matchId: '1',
      league: 'EPL',
      kickoff: '2026-07-06T15:00:00Z',
      bookmaker: 'Pinnacle',
      odds: 2.0,
      probability: 0.60,
      expectedValue: 0.20 // 0.6 * 2 - 1
    },
    {
      matchId: '2',
      league: 'La Liga',
      kickoff: '2026-07-06T18:00:00Z',
      bookmaker: 'Bet365',
      odds: 3.0,
      probability: 0.40,
      expectedValue: 0.20 // 0.4 * 3 - 1
    }
  ];

  it('should size Flat Staking correctly', () => {
    const allocations = PortfolioOptimizer.flatStaking(mockCandidates, 0.02);
    expect(allocations[0].weight).toBe(0.02);
    expect(allocations[1].weight).toBe(0.02);
  });

  it('should size Kelly Staking correctly', () => {
    // raw Kelly 1: 0.20 / (2.0 - 1.0) = 0.20. Quarter-Kelly = 0.05
    // raw Kelly 2: 0.20 / (3.0 - 1.0) = 0.10. Quarter-Kelly = 0.025
    const allocations = PortfolioOptimizer.kellyStaking(mockCandidates, 0.25);
    expect(allocations[0].weight).toBeCloseTo(0.05, 4);
    expect(allocations[1].weight).toBeCloseTo(0.025, 4);
  });

  it('should size Risk Parity Staking correctly based on variance', () => {
    const allocations = PortfolioOptimizer.riskParityStaking(mockCandidates, 0.10);
    const totalWeight = allocations.reduce((sum, a) => sum + a.weight, 0);

    expect(totalWeight).toBeCloseTo(0.10, 4);
    // Lower variance (odds 2.0) should get higher weight than higher variance (odds 3.0)
    expect(allocations[0].weight).toBeGreaterThan(allocations[1].weight);
  });
});
