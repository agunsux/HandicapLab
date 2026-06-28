import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrierCalculator } from '../src/lib/settlement/brier-calculator';
import { CLVCalculator } from '../src/lib/settlement/clv-calculator';
import { ProfitCalculator } from '../src/lib/settlement/profit-calculator';
import { MatchSettler } from '../src/lib/settlement/match-settler';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase Client
vi.mock('../src/lib/supabase.server', () => {
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockUpdate = vi.fn(() => ({ eq: vi.fn() }));
  const mockInsert = vi.fn();
  
  const mockEq = vi.fn();
  const mockEqResult: any = {
    eq: mockEq,
    maybeSingle: mockMaybeSingle,
    is: vi.fn(() => ({ error: null, data: [] }))
  };
  mockEq.mockReturnValue(mockEqResult);

  const mockSelect = vi.fn(() => ({
    eq: mockEq,
    is: vi.fn(() => ({ error: null, data: [] }))
  }));

  return {
    supabase: {
      from: vi.fn(() => ({
        select: mockSelect,
        update: mockUpdate,
        insert: mockInsert
      })),
      rpc: vi.fn()
    }
  };
});

describe('Settlement Modules', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('BrierCalculator', () => {
    it('should calculate Brier score for Moneyline (ML) to be 0.0 (non-binary market excluded)', () => {
      const score = BrierCalculator.calculate(
        'ML',
        { pHome: 0.60, pDraw: 0.25, pAway: 0.15 },
        2,
        0
      );
      expect(score).toBe(0.0);
    });

    it('should calculate Brier score for Asian Handicap (AH)', () => {
      // line = -0.5, actual = 1-0 (diff = 1). Net = 1 - 0.5 = 0.5 > 0 (Home wins)
      // pHome = 0.70. pAway = 0.30
      // expected = ((0.7-1)^2 + (0.3-0)^2) / 2 = (0.09 + 0.09) / 2 = 0.09
      const score = BrierCalculator.calculate(
        'AH',
        {
          ah_line: -0.5,
          pAhHome: { '-0.5': 0.70 },
          pAhAway: { '-0.5': 0.30 }
        },
        1,
        0
      );
      expect(score).toBe(0.0900);
    });

    it('should calculate Brier score for Over/Under (OU)', () => {
      // line = 2.5, actual = 2-1 (total = 3 > 2.5 -> Over wins)
      // pOver = 0.60. pUnder = 0.40
      // expected = ((0.6-1)^2 + (0.4-0)^2) / 2 = (0.16 + 0.16) / 2 = 0.16
      const score = BrierCalculator.calculate(
        'OU',
        {
          ou_line: 2.5,
          pOver: { '2.5': 0.60 },
          pUnder: { '2.5': 0.40 }
        },
        2,
        1
      );
      expect(score).toBe(0.1600);
    });
  });

  describe('CLVCalculator', () => {
    it('should calculate CLV using formula (closingOdds / predictionOdds) - 1', () => {
      // predOdds = 2.0, closingOdds = 2.20
      // clv = (2.20 / 2.0) - 1.0 = 0.10
      const clv = CLVCalculator.calculate(2.0, 2.20);
      expect(clv).toBe(0.10);
    });

    it('should return null if closing odds are invalid', () => {
      expect(CLVCalculator.calculate(2.0, null)).toBeNull();
      expect(CLVCalculator.calculate(2.0, 0)).toBeNull();
    });
  });

  describe('ProfitCalculator', () => {
    it('should calculate profit for winning bets', () => {
      // stake = 0.10, odds = 2.0
      // profit = 0.10 * (2.0 - 1) = 0.10
      const profit = ProfitCalculator.calculate('home', 'ML', '1X2', 0.10, 2.0, 2, 0);
      expect(profit).toBe(0.10);
    });

    it('should calculate loss for losing bets', () => {
      // stake = 0.05
      // profit = -0.05
      const profit = ProfitCalculator.calculate('away', 'ML', '1X2', 0.05, 2.0, 2, 0);
      expect(profit).toBe(-0.05);
    });

    it('should return 0 for push bets', () => {
      // handicap -1.0, score 2-1 (diff = 1). Net = 1 - 1 = 0 -> Push
      const profit = ProfitCalculator.calculate('home', 'AH', '-1.0', 0.10, 2.0, 2, 1);
      expect(profit).toBe(0);
    });
  });

  describe('MatchSettler', () => {
    it('should handle recent matches and settle them', async () => {
      // Mock matches select
      const mockMatches = [
        { id: 'match-1', status: 'finished', home_goals: 2, away_goals: 1, kickoff: new Date().toISOString() }
      ];

      // Mock predictions select
      const mockPredictions = [
        {
          id: 'pred-1',
          match_id: 'match-1',
          market_type: 'ML',
          prediction: { pHome: 0.60, pDraw: 0.25, pAway: 0.15 },
          odds_snapshot: { homeOdds: 2.0, drawOdds: 3.0, awayOdds: 4.0 },
          closing_odds: { homeOdds: 2.10, drawOdds: 3.10, awayOdds: 4.10 },
          model_version: 'prematch-v1'
        }
      ];

      // Setup supabase mock chain
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null }); // existing outcome check
        const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const mockEq = vi.fn(() => ({
          maybeSingle: mockMaybeSingle,
          is: vi.fn().mockResolvedValue({ data: mockPredictions, error: null })
        }));
        
        const mockSelect = vi.fn(() => ({
          eq: mockEq,
          is: vi.fn(() => ({ data: mockPredictions, error: null }))
        }));

        if (table === 'matches') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gt: vi.fn().mockResolvedValue({ data: mockMatches, error: null })
              }))
            }))
          } as any;
        }

        return {
          select: mockSelect,
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null })
          })),
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        } as any;
      });

      const summary = await MatchSettler.settleRecentMatches();
      expect(summary.matchesChecked).toBe(1);
      expect(summary.predictionsSettled).toBe(1);
      expect(summary.settledPredictionIds).toContain('pred-1');
    });
  });
});
