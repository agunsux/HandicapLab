import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPredictionCron } from '../src/lib/crons/prediction';
import { supabase } from '../src/lib/supabase.server';
import { FeatureEngine } from '../src/lib/engines/feature-engine';
import { ProbabilityEngine } from '../src/lib/engines/probability-engine';

vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

vi.mock('../src/lib/engines/feature-engine', () => {
  return {
    FeatureEngine: {
      build: vi.fn().mockResolvedValue({ leagueId: 'epl', homeRestDays: 4, homeTravelKm: 0 }),
    },
  };
});

vi.mock('../src/lib/engines/probability-engine', () => {
  return {
    ProbabilityEngine: {
      predict: vi.fn().mockResolvedValue({
        pHome: 0.50,
        pDraw: 0.25,
        pAway: 0.25,
        pAhHome: { '-0.5': 0.50 },
        pAhAway: { '-0.5': 0.50 },
        pOver: { '2.5': 0.50 },
        pUnder: { '2.5': 0.50 },
        expectedGoals: 2.5,
        pBttsYes: 0.50,
        pBttsNo: 0.50,
        confidence: {
          confidenceScore: 80,
          dataQualityScore: 80,
          recommendationStatus: 'Recommended',
          reasons: ['Seeded test reasons'],
          modelConfidence: 0.80,
          dataConfidence: 0.80,
          marketConfidence: 0.80,
          finalConfidence: 0.80
        },
      }),
    },
  };
});

describe('runPredictionCron determinism', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should deterministically enforce MISSING_ODDS canonical contract without synthetic fallback', async () => {
    const mockMatches = [
      { id: 'match_123', status: 'upcoming', kickoff: '2026-07-06T18:00:00Z', league_id: '39', league: 'Premier League' },
    ];

    const collectedOddsHistory1: any[] = [];
    const collectedOddsHistory2: any[] = [];

    // Helper to create mock chain for database queries
    const createMockChain = () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'new_pred_id' }, error: null }),
        maybeSingle: vi.fn().mockImplementation(() => {
          return Promise.resolve({ data: null, error: null });
        }),
        insert: vi.fn().mockImplementation(() => {
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'new_pred_id' }, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'new_pred_id' }, error: null }),
          };
        }),
        update: vi.fn().mockImplementation(() => {
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'new_pred_id' }, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'new_pred_id' }, error: null }),
          };
        }),
        upsert: vi.fn().mockImplementation(() => {
          return {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'new_pred_id' }, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'new_pred_id' }, error: null }),
          };
        }),
      };
      return chain;
    };

    const mockFrom = vi.mocked(supabase.from);

    // Run 1 configuration
    mockFrom.mockImplementation((table: string) => {
      const chain = createMockChain();
      
      chain.maybeSingle = vi.fn().mockImplementation(() => {
        if (table === 'paper_trading_config') {
          return Promise.resolve({ data: { min_edge_threshold: 2.0, min_confidence_threshold: 70.0 }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      chain.insert = vi.fn().mockImplementation((payload) => {
        if (table === 'odds_history') {
          collectedOddsHistory1.push(payload);
        }
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'new_pred_id' }, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'new_pred_id' }, error: null }),
        };
      });

      if (table === 'matches') {
        chain.select = vi.fn().mockReturnThis();
        chain.eq = vi.fn().mockReturnThis();
        chain.in = vi.fn().mockReturnThis();
        (chain as any).then = vi.fn((resolve: any) => resolve({ data: mockMatches, error: null }));
      }

      return chain as any;
    });

    await runPredictionCron();

    // Run 2 configuration
    mockFrom.mockImplementation((table: string) => {
      const chain = createMockChain();
      
      chain.maybeSingle = vi.fn().mockImplementation(() => {
        if (table === 'paper_trading_config') {
          return Promise.resolve({ data: { min_edge_threshold: 2.0, min_confidence_threshold: 70.0 }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      chain.insert = vi.fn().mockImplementation((payload) => {
        if (table === 'odds_history') {
          collectedOddsHistory2.push(payload);
        }
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'new_pred_id' }, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'new_pred_id' }, error: null }),
        };
      });

      if (table === 'matches') {
        chain.select = vi.fn().mockReturnThis();
        chain.eq = vi.fn().mockReturnThis();
        chain.in = vi.fn().mockReturnThis();
        (chain as any).then = vi.fn((resolve: any) => resolve({ data: mockMatches, error: null }));
      }

      return chain as any;
    });

    await runPredictionCron();

    // Assert that synthetic fallbacks were NOT generated
    expect(collectedOddsHistory1.length).toBe(0);
    expect(collectedOddsHistory2.length).toBe(0);
    
    // Assert that the new canonical contract was followed for MISSING_ODDS
    expect(mockFrom).toHaveBeenCalledWith('prediction_ledger');
    expect(mockFrom).toHaveBeenCalledWith('prediction_decisions');
    expect(mockFrom).toHaveBeenCalledWith('daily_picks');
  });
});
