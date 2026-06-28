import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPredictionCron } from '../src/lib/crons/prediction';
import { runOddsSnapshotCron } from '../src/lib/crons/oddsSnapshot';
import { runSettlementCron } from '../src/lib/crons/settlement';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase client
vi.mock('../src/lib/supabase.server', () => {
  class MockBuilder {
    constructor(private table: string) {}

    select = vi.fn().mockReturnThis();
    eq = vi.fn().mockReturnThis();
    or = vi.fn().mockReturnThis();
    lt = vi.fn().mockReturnThis();
    order = vi.fn().mockReturnThis();
    limit = vi.fn().mockReturnThis();
    in = vi.fn().mockReturnThis();
    is = vi.fn().mockReturnThis();
    gt = vi.fn().mockReturnThis();

    single = vi.fn().mockImplementation(() => {
      if (this.table === 'matches') {
        return Promise.resolve({
          data: {
            id: 'match-upcoming-1',
            home_team: 'Arsenal',
            away_team: 'Chelsea',
            league: 'Premier League',
            kickoff: new Date(Date.now() + 86400000).toISOString(),
            status: 'upcoming',
            home_goals: null,
            away_goals: null
          },
          error: null
        });
      }
      return Promise.resolve({ data: { id: 'new-pred-uuid' }, error: null });
    });

    maybeSingle = vi.fn().mockImplementation(() => {
      if (this.table === 'matches') {
        return Promise.resolve({
          data: {
            id: 'match-upcoming-1',
            home_team: 'Arsenal',
            away_team: 'Chelsea',
            league: 'Premier League',
            kickoff: new Date(Date.now() + 86400000).toISOString(),
            status: 'upcoming',
            home_goals: null,
            away_goals: null
          },
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    then = vi.fn().mockImplementation((resolve: any) => {
      let resolvedData: any = [];
      if (this.table === 'matches') {
        resolvedData = [
          {
            id: 'match-upcoming-1',
            home_team: 'Arsenal',
            away_team: 'Chelsea',
            league: 'Premier League',
            kickoff: new Date(Date.now() + 86400000).toISOString(),
            status: 'upcoming',
            home_goals: null,
            away_goals: null
          }
        ];
      } else if (this.table === 'predictions') {
        resolvedData = [
          {
            id: 'pred-1',
            match_id: 'match-upcoming-1',
            market_type: 'ML',
            prediction: { pHome: 0.6, pDraw: 0.25, pAway: 0.15 },
            odds_snapshot: { homeOdds: 2.0, drawOdds: 3.0, awayOdds: 4.0, timestamp: Date.now() - 50000 },
            entry_odds: 2.0,
            selection: 'home',
            closing_odds: null,
            brier_score: null,
            clv: null,
            generated_at: new Date(Date.now() - 100000).toISOString()
          }
        ];
      } else if (this.table === 'paper_trades') {
        resolvedData = [
          {
            id: 'trade-1',
            user_id: 'user-1',
            prediction_id: 'pred-1',
            match_id: 'match-upcoming-1',
            market_type: 'ML',
            market_subtype: '1X2',
            selection: 'home',
            entry_odds: 2.0,
            stake: 0.05,
            status: 'pending'
          }
        ];
      }
      return resolve({ data: resolvedData, error: null });
    });
  }

  const mockFrom = vi.fn((table: string) => {
    const builder = new MockBuilder(table);
    const chain: any = {
      select: vi.fn().mockImplementation(() => chain),
      eq: vi.fn().mockImplementation(() => chain),
      or: vi.fn().mockImplementation(() => chain),
      lt: vi.fn().mockImplementation(() => chain),
      order: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockImplementation(() => chain),
      in: vi.fn().mockImplementation(() => chain),
      is: vi.fn().mockImplementation(() => chain),
      gt: vi.fn().mockImplementation(() => chain),
      single: vi.fn().mockImplementation(() => {
        if (table === 'matches') {
          return Promise.resolve({
            data: {
              id: 'match-upcoming-1',
              home_team: 'Arsenal',
              away_team: 'Chelsea',
              league: 'Premier League',
              kickoff: new Date(Date.now() + 86400000).toISOString(),
              status: 'upcoming',
              home_goals: null,
              away_goals: null
            },
            error: null
          });
        }
        return Promise.resolve({ data: { id: 'new-pred-uuid' }, error: null });
      }),
      maybeSingle: vi.fn().mockImplementation(() => {
        if (table === 'matches') {
          return Promise.resolve({
            data: {
              id: 'match-upcoming-1',
              home_team: 'Arsenal',
              away_team: 'Chelsea',
              league: 'Premier League',
              kickoff: new Date(Date.now() + 86400000).toISOString(),
              status: 'upcoming',
              home_goals: null,
              away_goals: null
            },
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      insert: vi.fn().mockImplementation(() => chain),
      update: vi.fn().mockImplementation(() => chain),
      then: builder.then
    };
    return chain;
  });

  return {
    supabase: {
      from: mockFrom,
      rpc: vi.fn()
    }
  };
});

describe('Cron Infrastructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Prediction Cron', () => {
    it('runs prediction pipeline and stores prediction + snapshot', async () => {
      const result = await runPredictionCron();
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(3); // ML, AH, OU
      expect(result.results[0].success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('predictions');
      expect(supabase.from).toHaveBeenCalledWith('odds_history');
    });
  });

  describe('Odds Snapshot Cron', () => {
    it('snapshots odds for upcoming matches', async () => {
      const result = await runOddsSnapshotCron();
      expect(result.success).toBe(true);
      expect(result.snapshotsStored).toBe(3); // 3 markets for the 1 match
      expect(supabase.from).toHaveBeenCalledWith('odds_history');
    });
  });

  describe('Settlement Cron', () => {
    it('settles finished matches, predictions, and paper trades', async () => {
      const result = await runSettlementCron();
      expect(result.success).toBe(true);
      expect(result.predictionsSettled).toBe(1);
      expect(result.tradesSettled).toBe(1);
      expect(supabase.from).toHaveBeenCalledWith('predictions');
      expect(supabase.from).toHaveBeenCalledWith('paper_trades');
    });
  });
});
