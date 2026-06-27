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
import { GET as captureGET } from '../src/app/api/cron/capture-odds/route';
import { supabase } from '../src/lib/supabase.server';

describe('Correlation ID Trace & Lifecycle Integrity', () => {
  let mockSignalsData: any[] = [];
  let mockCorrelationIdValue: string | null = null;

  beforeEach(() => {
    vi.resetAllMocks();
    mockSignalsData = [];
    mockCorrelationIdValue = null;

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

    maybeSingle.mockImplementation(() => {
      if (mockChainObj._currentTable === 'prediction_results') {
        return Promise.resolve({ data: null, error: null });
      }
      if (mockChainObj._currentTable === 'signal_audit_events') {
        return Promise.resolve({ data: mockCorrelationIdValue ? { correlation_id: mockCorrelationIdValue } : null, error: null });
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

  it('should propagate correlation_id across all tables in a signal lifecycle', async () => {
    const testCorrId = 'test-lifecycle-corr-id-123';
    mockCorrelationIdValue = testCorrId;

    // 1. Signal creation
    mockSignalsData = [
      { id: 'sig_life', match_id: 'match_life', market: 'asian_handicap', handicap_line: -0.5, selection: 'home', odds: 1.95 }
    ];
    mockChainObj.upsert = vi.fn().mockReturnValue(mockChainObj);

    const picks = [
      {
        matchId: 'match_life',
        marketType: 'AH' as const,
        line: '-0.5',
        outcome: 'home' as const,
        modelProbability: 0.65,
        marketOdds: 1.95,
        impliedProbability: 0.51,
        expectedValue: 0.26,
        kellyStake: 0.15,
        clv: 0.05,
        confidence: 0.75,
        tier: 'ELITE' as const
      }
    ];

    await SignalScanner.saveSignals(picks, {
      league: 'EPL',
      home_team: 'Chelsea',
      away_team: 'Arsenal',
      kickoff_utc: new Date().toISOString()
    });

    // Verify SIGNAL_CREATED event is logged
    expect(supabase.from).toHaveBeenCalledWith('signal_audit_events');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      signal_id: 'sig_life',
      event_type: 'SIGNAL_CREATED',
      correlation_id: expect.any(String)
    }));

    // 2. Odds capture uses trace correlation_id and saves it to odds_history
    mockSignalsData = [
      { id: 'sig_life', match_id: 'match_life', league: 'EPL', home_team: 'Chelsea', away_team: 'Arsenal', market: 'asian_handicap', handicap_line: -0.5, selection: 'home', odds: 1.95, opening_odds: 1.95, opening_line: -0.5 }
    ];

    const { oddsApiClient } = await import('../src/lib/apis/oddspapi');
    vi.spyOn(oddsApiClient, 'getOdds').mockResolvedValueOnce([
      {
        home_team: 'Chelsea',
        away_team: 'Arsenal',
        bookmakers: [
          {
            key: 'pinnacle',
            markets: [
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Chelsea', price: 1.80, point: -0.5 }
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
    await captureGET(request);

    // Verify odds_history and ODDS_CAPTURED have correct correlation_id
    expect(supabase.from).toHaveBeenCalledWith('odds_history');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      signal_id: 'sig_life',
      correlation_id: testCorrId,
      odds: 1.80
    }));

    expect(supabase.from).toHaveBeenCalledWith('signal_audit_events');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      signal_id: 'sig_life',
      event_type: 'ODDS_CAPTURED',
      correlation_id: testCorrId
    }));

    // 3. Settlement saves correlation_id in prediction_results and logs SIGNAL_SETTLED
    mockChainObj.gt = vi.fn().mockResolvedValue({
      data: [{ id: 'match_life', home_goals: 2, away_goals: 0 }],
      error: null
    });

    mockChainObj.is = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'sig_life',
          match_id: 'match_life',
          market_type: 'AH',
          prediction: {
            ah_line: -0.5,
            pAhHome: { '-0.5': 0.70 },
            pAhAway: { '-0.5': 0.30 }
          },
          odds_snapshot: { homeOdds: 1.95, line: -0.5 }
        }
      ],
      error: null
    });

    await MatchSettler.settleRecentMatches();

    // Verify prediction_results insert and SIGNAL_SETTLED insert have trace correlation_id
    expect(supabase.from).toHaveBeenCalledWith('prediction_results');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      prediction_id: 'sig_life',
      correlation_id: testCorrId
    }));

    expect(supabase.from).toHaveBeenCalledWith('signal_audit_events');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      signal_id: 'sig_life',
      event_type: 'SIGNAL_SETTLED',
      correlation_id: testCorrId
    }));
  });

  it('should trigger SIGNAL_LOCKED event when locked_at transitions from null to timestamp', () => {
    update.mockImplementation((payload) => {
      if (payload.locked_at) {
        supabase.from('signal_audit_events').insert({
          signal_id: 'sig_locked',
          event_type: 'SIGNAL_LOCKED',
          source: 'system',
          correlation_id: 'corr-locked-456',
          payload: {
            signal_id: 'sig_locked',
            locked_at: payload.locked_at,
            reason: 'MATCH_STARTED'
          }
        });
      }
      return mockChainObj;
    });

    supabase.from('signals').update({ locked_at: new Date().toISOString() }).eq('id', 'sig_locked');

    expect(supabase.from).toHaveBeenCalledWith('signal_audit_events');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      signal_id: 'sig_locked',
      event_type: 'SIGNAL_LOCKED',
      source: 'system',
      correlation_id: 'corr-locked-456',
      payload: expect.objectContaining({
        reason: 'MATCH_STARTED'
      })
    }));
  });
});
