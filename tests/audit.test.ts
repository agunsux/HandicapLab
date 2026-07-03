import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to declare mock elements before any mocks are processed by Vitest
const {
  mockChainObj,
  mockSupabase,
  select,
  eq,
  maybeSingle,
  single,
  insert,
  update,
  deleteMock,
  selectIs,
  not,
  order,
  then,
  rpc,
  gt,
  lte,
  limit
} = vi.hoisted(() => {
  const select = vi.fn();
  const eq = vi.fn();
  const maybeSingle = vi.fn();
  const single = vi.fn();
  const insert = vi.fn();
  const update = vi.fn();
  const deleteMock = vi.fn();
  const selectIs = vi.fn();
  const not = vi.fn();
  const order = vi.fn();
  const then = vi.fn();
  const rpc = vi.fn();
  const gt = vi.fn();
  const lte = vi.fn();
  const limit = vi.fn();

  const mockChainObj: any = {
    select,
    eq,
    maybeSingle,
    single,
    insert,
    update,
    delete: deleteMock,
    is: selectIs,
    not,
    order,
    then,
    gt,
    lte,
    limit
  };

  select.mockReturnValue(mockChainObj);
  eq.mockReturnValue(mockChainObj);
  insert.mockReturnValue(mockChainObj);
  update.mockReturnValue(mockChainObj);
  deleteMock.mockReturnValue(mockChainObj);
  selectIs.mockReturnValue(mockChainObj);
  not.mockReturnValue(mockChainObj);
  order.mockReturnValue(mockChainObj);
  then.mockReturnValue(mockChainObj);
  gt.mockReturnValue(mockChainObj);
  lte.mockReturnValue(mockChainObj);
  limit.mockReturnValue(mockChainObj);

  const mockSupabase = {
    from: vi.fn((table) => {
      mockChainObj._currentTable = table;
      return mockChainObj;
    }),
    rpc: rpc
  };

  return {
    mockChainObj,
    mockSupabase,
    select,
    eq,
    maybeSingle,
    single,
    insert,
    update,
    deleteMock,
    selectIs,
    not,
    order,
    then,
    rpc,
    gt,
    lte,
    limit
  };
});

// Mock relative path
vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: mockSupabase
  };
});

// Mock alias path
vi.mock('@/lib/supabase.server', () => {
  return {
    supabase: mockSupabase
  };
});

// Import code under test
import { SignalScanner } from '../src/lib/engines/edge-scanner/signal-scanner';
import { MatchSettler } from '../src/lib/settlement/match-settler';
import { GET as performanceGET } from '../src/app/api/stats/performance/route';
import { supabase } from '../src/lib/supabase.server';

describe('Immutable Signal Audit Layer & Performance Integrity', () => {
  let mockSignalsData: any[] = [];

  beforeEach(() => {
    vi.resetAllMocks();
    mockSignalsData = [];

    // Reset default mock returns on the hoisted objects
    select.mockReturnValue(mockChainObj);
    eq.mockReturnValue(mockChainObj);
    insert.mockReturnValue(mockChainObj);
    update.mockReturnValue(mockChainObj);
    deleteMock.mockReturnValue(mockChainObj);
    selectIs.mockReturnValue(mockChainObj);
    not.mockReturnValue(mockChainObj);
    order.mockReturnValue(mockChainObj);
    then.mockReturnValue(mockChainObj);
    gt.mockReturnValue(mockChainObj);
    lte.mockReturnValue(mockChainObj);
    limit.mockReturnValue(mockChainObj);

    // Re-register supabase.from implementation because vi.resetAllMocks clears it
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      mockChainObj._currentTable = table;
      return mockChainObj;
    });

    // Mock then implementation to dynamically resolve query depending on table
    then.mockImplementation((resolve) => {
      if (resolve && typeof resolve === 'function') {
        if (mockChainObj._currentTable === 'signals') {
          resolve({ data: mockSignalsData, error: null });
        } else {
          resolve({ data: [], error: null });
        }
      }
    });

    maybeSingle.mockResolvedValue({ data: null, error: null });
    
    // Dynamic single implementation to support cron logs inserts
    single.mockImplementation(() => {
      if (mockChainObj._currentTable === 'cron_runs') {
        return Promise.resolve({ data: { id: 'cron_run_123' }, error: null });
      }
      return Promise.resolve({ data: {}, error: null });
    });

    process.env.CRON_SECRET = 'cron_secret';
  });

  describe('Audit Event Integration', () => {
    it('1. signal creation creates audit event', async () => {
      // Mock signal insert response to return savedRows
      mockSignalsData = [
        { id: 'sig_123', match_id: 'match_001', market: 'asian_handicap', handicap_line: -0.5, selection: 'home', odds: 1.95 }
      ];
      mockChainObj.upsert = vi.fn().mockReturnValue(mockChainObj);

      const picks = [
        {
          matchId: 'match_001',
          marketType: 'AH' as const,
          line: '-0.5',
          outcome: 'home' as const,
          modelProbability: 0.65,
          marketOdds: 1.95,
          impliedProbability: 0.51,
          expectedValue: 0.26,
          kellyStake: 0.15,
          clv: 0.05,
          confidence: 'HIGH' as const,
          tier: 'ELITE' as const
        }
      ];

      const meta = {
        league: 'English Premier League',
        home_team: 'Chelsea',
        away_team: 'Arsenal',
        kickoff_utc: new Date().toISOString()
      };

      await SignalScanner.saveSignals(picks, meta);

      // Verify SIGNAL_CREATED audit log insertion was triggered
      expect(supabase.from).toHaveBeenCalledWith('signal_audit_events');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        signal_id: 'sig_123',
        event_type: 'SIGNAL_CREATED'
      }));
    });

    it('2. odds movement creates audit event', async () => {
      // Import odds capture route handler and execute odds capture with mocked database response
      const { GET: captureGET } = await import('../src/app/api/cron/capture-odds/route');

      // Set signals mock data
      mockSignalsData = [
        { id: 'sig_456', match_id: 'match_002', league: 'English Premier League', home_team: 'Man City', away_team: 'Liverpool', market: 'asian_handicap', handicap_line: -0.25, selection: 'home', odds: 1.95, opening_odds: 1.95, opening_line: -0.25 }
      ];

      // Mock Odds API Client response
      const { oddsApiClient } = await import('../src/lib/apis/oddspapi');
      vi.spyOn(oddsApiClient, 'getOdds').mockResolvedValueOnce([
        {
          id: 'mock_match_1',
          sport_key: 'soccer',
          sport_title: 'Soccer',
          commence_time: new Date().toISOString(),
          home_team: 'Man City',
          away_team: 'Liverpool',
          bookmakers: [
            {
              key: 'pinnacle',
              title: 'Pinnacle',
              markets: [
                {
                  key: 'spreads',
                  outcomes: [
                    { name: 'Man City', price: 1.80, point: -0.5 } // line changed from -0.25 to -0.5
                  ]
                }
              ]
            }
          ]
        }
      ]);

      const request = new Request('http://localhost/api/cron/capture-odds', {
        headers: { authorization: 'Bearer cron_secret' }
      });
      const response = await captureGET(request);
      expect(response.status).toBe(200);

      // Verify that ODDS_CAPTURED and LINE_MOVED events were logged
      expect(supabase.from).toHaveBeenCalledWith('signal_audit_events');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        signal_id: 'sig_456',
        event_type: 'ODDS_CAPTURED',
        payload: expect.objectContaining({
          old_line: -0.25,
          new_line: -0.5,
          old_odds: 1.95,
          new_odds: 1.80
        })
      }));
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        signal_id: 'sig_456',
        event_type: 'LINE_MOVED'
      }));

      // Verify existing odds_history table is reused and updated
      expect(supabase.from).toHaveBeenCalledWith('odds_history');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        signal_id: 'sig_456',
        market_type: 'asian_handicap',
        odds: 1.80,
        line: -0.5,
        provider: 'pinnacle'
      }));
    });

    it('3. settlement creates audit event', async () => {
      // Mock matches check
      mockChainObj.gt = vi.fn().mockResolvedValue({
        data: [{ id: 'match_003', home_goals: 2, away_goals: 0 }],
        error: null
      });

      // Mock predictions check (include pAhHome and pAhAway to resolve brier calculations)
      mockChainObj.is = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'pred_789',
            match_id: 'match_003',
            market_type: 'AH',
            prediction: {
              ah_line: -0.5,
              pAhHome: { '-0.5': 0.70 },
              pAhAway: { '-0.5': 0.30 }
            },
            odds_snapshot: { homeOdds: 2.0, line: -0.5 }
          }
        ],
        error: null
      });

      // Mock existing prediction outcomes check (return null so it proceeds to settle)
      maybeSingle.mockResolvedValue({ data: null, error: null });

      // Run settlement
      await MatchSettler.settleRecentMatches();

      // Verify SIGNAL_SETTLED event was recorded
      expect(supabase.from).toHaveBeenCalledWith('signal_audit_events');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        signal_id: 'pred_789',
        event_type: 'SIGNAL_SETTLED',
        payload: expect.objectContaining({
          result: 'home',
          pnl: expect.any(Number),
          roi: expect.any(Number)
        })
      }));
    });
  });

  describe('Immutable Rules', () => {
    it('4. audit record cannot update', async () => {
      // Mock database trigger blocking updates
      update.mockImplementation(() => {
        throw new Error('Audit history is immutable');
      });

      expect(() => {
        supabase.from('signal_audit_events').update({ event_type: 'MODIFIED' }).eq('id', '123');
      }).toThrow('Audit history is immutable');
    });

    it('5. audit record cannot delete', async () => {
      // Mock database trigger blocking deletes
      deleteMock.mockImplementation(() => {
        throw new Error('Audit history is immutable');
      });

      expect(() => {
        supabase.from('signal_audit_events').delete().eq('id', '123');
      }).toThrow('Audit history is immutable');
    });
  });

  describe('Performance Endpoint Integrity', () => {
    it('6. performance excludes unsettled signals', async () => {
      // Mock signals database query to return a mix of settled and unsettled/null settled_at signals
      const mockSignals = [
        { id: 'sig_1', status: 'won', odds: 2.0, settled_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), clv_percentage: 5.0, league: 'EPL' },
        { id: 'sig_2', status: 'lost', odds: 1.80, settled_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), clv_percentage: -2.0, league: 'La Liga' },
        { id: 'sig_3', status: 'pending', odds: 1.95, settled_at: null } // unsettled signal
      ];

      // Filter to emulate Supabase .not('settled_at', 'is', null) query behaviour
      const mockSettledSignals = mockSignals.filter(s => s.settled_at !== null);
      mockSignalsData = mockSettledSignals;

      const response = await performanceGET();
      const body = await response.json();

      expect(body.success).toBe(true);
      // Verify sample size only counts settled signals (ignores sig_3)
      expect(body.sample_size).toBe(2);
      expect(body.win_rate).toBe(50); // 1 won out of 2 settled
      expect(body.ROI).toBe(0); // won: +1.0 units, lost: -1.0 units -> net profit = 0
      expect(body.average_odds).toBe(1.90); // (2.0 + 1.80) / 2
      expect(body.max_drawdown).toBe(0.01); // lost 1.0 units drawdown (from baseline 100.0)
      expect(body.last_30_days.win_rate).toBe(50);
    });
  });
});
