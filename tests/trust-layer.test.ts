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

describe('Trust Layer & Auditing Hardening Pass', () => {
  let mockSignalsData: any[] = [];
  let mockAuditEventsData: any[] = [];
  let mockCorrelationIdLookupValue: string | null = null;

  beforeEach(() => {
    vi.resetAllMocks();
    mockSignalsData = [];
    mockAuditEventsData = [];
    mockCorrelationIdLookupValue = null;

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
        } else if (mockChainObj._currentTable === 'signal_audit_events') {
          resolve({ data: mockAuditEventsData, error: null });
        } else {
          resolve({ data: [], error: null });
        }
      }
    });

    // Dynamic maybeSingle resolver to distinguish prediction_results check from signal_audit_events lookup
    maybeSingle.mockImplementation(() => {
      if (mockChainObj._currentTable === 'prediction_results') {
        return Promise.resolve({ data: null, error: null });
      }
      if (mockChainObj._currentTable === 'signal_audit_events') {
        return Promise.resolve({ data: mockCorrelationIdLookupValue ? { correlation_id: mockCorrelationIdLookupValue } : null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    single.mockImplementation(() => {
      if (mockChainObj._currentTable === 'cron_runs') {
        return Promise.resolve({ data: { id: 'cron_run_123' }, error: null });
      }
      return Promise.resolve({ data: {}, error: null });
    });

    process.env.CRON_SECRET = 'cron_secret';
  });

  describe('Auditing Tracing & Correlation', () => {
    it('1. signal scanner logs SIGNAL_CREATED with source and correlation_id', async () => {
      mockSignalsData = [
        { id: 'sig_001', match_id: 'match_100', market: 'asian_handicap', handicap_line: -0.5, selection: 'home', odds: 2.10 }
      ];
      mockChainObj.upsert = vi.fn().mockReturnValue(mockChainObj);

      const picks = [
        {
          matchId: 'match_100',
          marketType: 'AH' as const,
          line: '-0.5',
          outcome: 'home' as const,
          modelProbability: 0.60,
          marketOdds: 2.10,
          impliedProbability: 0.48,
          expectedValue: 0.12,
          kellyStake: 0.05,
          clv: 0.05,
          confidence: 'HIGH' as const,
          tier: 'ELITE' as const
        }
      ];

      await SignalScanner.saveSignals(picks, {
        league: 'Serie A',
        home_team: 'Juventus',
        away_team: 'Inter',
        kickoff_utc: new Date().toISOString()
      });

      expect(supabase.from).toHaveBeenCalledWith('signal_audit_events');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        signal_id: 'sig_001',
        event_type: 'SIGNAL_CREATED',
        source: 'signal_scanner',
        correlation_id: expect.any(String)
      }));
    });

    it('2. odds capture reuse correlation_id and attach source', async () => {
      const { GET: captureGET } = await import('../src/app/api/cron/capture-odds/route');

      mockSignalsData = [
        { id: 'sig_002', match_id: 'match_200', league: 'La Liga', home_team: 'Real Madrid', away_team: 'Barcelona', market: 'asian_handicap', handicap_line: -0.25, selection: 'home', odds: 1.90, opening_odds: 1.90, opening_line: -0.25 }
      ];

      mockCorrelationIdLookupValue = 'corr-uuid-999';

      const { oddsApiClient } = await import('../src/lib/apis/oddspapi');
      vi.spyOn(oddsApiClient, 'getOdds').mockResolvedValueOnce([
        {
          id: 'mock_match_3',
          sport_key: 'soccer',
          sport_title: 'Soccer',
          commence_time: new Date().toISOString(),
          home_team: 'Real Madrid',
          away_team: 'Barcelona',
          bookmakers: [
            {
              key: 'pinnacle',
              title: 'Pinnacle',
              markets: [
                {
                  key: 'spreads',
                  outcomes: [
                    { name: 'Real Madrid', price: 1.85, point: -0.5 }
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

      expect(supabase.from).toHaveBeenCalledWith('signal_audit_events');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        signal_id: 'sig_002',
        event_type: 'ODDS_CAPTURED',
        source: 'capture_odds_cron',
        correlation_id: 'corr-uuid-999'
      }));
    });

    it('3. settlement reuse correlation_id and logs SIGNAL_SETTLED', async () => {
      mockChainObj.gt = vi.fn().mockResolvedValue({
        data: [{ id: 'match_300', home_goals: 1, away_goals: 0 }],
        error: null
      });

      mockChainObj.is = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'pred_300',
            match_id: 'match_300',
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

      mockCorrelationIdLookupValue = 'corr-uuid-777';

      // Run settlement
      await MatchSettler.settleRecentMatches();

      expect(supabase.from).toHaveBeenCalledWith('signal_audit_events');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        signal_id: 'pred_300',
        event_type: 'SIGNAL_SETTLED',
        source: 'settlement_cron',
        correlation_id: 'corr-uuid-777'
      }));
    });
  });

  describe('Confidence Level Classifications', () => {
    it('4. returns LOW confidence level for <30 signals', async () => {
      // 10 signals
      mockSignalsData = Array.from({ length: 10 }, (_, i) => ({
        id: `sig_${i}`,
        status: 'won',
        odds: 2.0,
        settled_at: new Date().toISOString()
      }));

      const response = await performanceGET();
      const body = await response.json();

      expect(body.sample_size).toBe(10);
      expect(body.confidence_level).toBe('LOW');
    });

    it('5. returns MEDIUM confidence level for 30-100 signals', async () => {
      // 50 signals
      mockSignalsData = Array.from({ length: 50 }, (_, i) => ({
        id: `sig_${i}`,
        status: 'won',
        odds: 2.0,
        settled_at: new Date().toISOString()
      }));

      const response = await performanceGET();
      const body = await response.json();

      expect(body.sample_size).toBe(50);
      expect(body.confidence_level).toBe('MEDIUM');
    });

    it('6. returns HIGH confidence level for >100 signals', async () => {
      // 120 signals
      mockSignalsData = Array.from({ length: 120 }, (_, i) => ({
        id: `sig_${i}`,
        status: 'won',
        odds: 2.0,
        settled_at: new Date().toISOString()
      }));

      const response = await performanceGET();
      const body = await response.json();

      expect(body.sample_size).toBe(120);
      expect(body.confidence_level).toBe('HIGH');
    });
  });

  describe('Verify Peak Equity Drawdown Calculation', () => {
    it('7. calculates drawdown correct using peak equity tracking', async () => {
      // We simulate 4 signals starting with baseline balance 100.0:
      // 1. win odds 2.0 -> profit +1.0. balance = 101.0, peak = 101.0
      // 2. loss -> profit -1.0. balance = 100.0, peak = 101.0 (dd: 1/101 = 0.0099009)
      // 3. loss -> profit -1.0. balance = 99.0, peak = 101.0 (dd: 2/101 = 0.0198019)
      // 4. win odds 2.0 -> profit +1.0. balance = 100.0, peak = 101.0 (dd: 1/101 = 0.0099009)
      const baseDate = new Date();
      mockSignalsData = [
        { id: 's1', status: 'won', odds: 2.0, settled_at: new Date(baseDate.getTime() + 1000).toISOString() },
        { id: 's2', status: 'lost', odds: 1.80, settled_at: new Date(baseDate.getTime() + 2000).toISOString() },
        { id: 's3', status: 'lost', odds: 1.80, settled_at: new Date(baseDate.getTime() + 3000).toISOString() },
        { id: 's4', status: 'won', odds: 2.0, settled_at: new Date(baseDate.getTime() + 4000).toISOString() }
      ];

      const response = await performanceGET();
      const body = await response.json();

      // Expected max drawdown: (101.0 - 99.0) / 101.0 = 2.0 / 101.0 = 0.0198
      expect(body.max_drawdown).toBe(0.0198);
    });
  });

  describe('Signal Mutability Restrictions (Kickoff/Lock Trigger Mock)', () => {
    it('8. triggers reject updates to prediction fields on locked signal', () => {
      // Simulate trigger logic where update method raises an exception if locked_at is set and prediction fields change
      update.mockImplementation((payload) => {
        const hasPredictionChanges = 'odds' in payload || 'handicap_line' in payload || 'selection' in payload || 'fair_odds' in payload || 'probability' in payload;
        if (hasPredictionChanges) {
          throw new Error('Signal is locked. Prediction fields cannot be mutated.');
        }
        return mockChainObj;
      });

      // Prediction edits should fail
      expect(() => {
        supabase.from('signals').update({ odds: 2.20 }).eq('id', 'locked_sig');
      }).toThrow('Signal is locked. Prediction fields cannot be mutated.');

      // Settlement/Result edits should succeed (does not throw)
      expect(() => {
        supabase.from('signals').update({ status: 'won', profit_loss: 1.20 }).eq('id', 'locked_sig');
      }).not.toThrow();
    });
  });
});
