import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks for Supabase client
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

// Mock Supabase path imports
vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: mockSupabase
  };
});

vi.mock('@/lib/supabase.server', () => {
  return {
    supabase: mockSupabase
  };
});

import { supabase } from '../src/lib/supabase.server';
import { simulateBankroll } from '../src/lib/analytics/bankroll-simulator';
import { DataQualityEngine } from '../src/lib/analytics/data-quality';
import { GET as performanceGET } from '../src/app/api/stats/performance/route';
import { SignalScanner } from '../src/lib/engines/edge-scanner/signal-scanner';

describe('Analytics Refinement Layer', () => {
  let mockSignalsData: any[] = [];
  let mockMatchesData: any[] = [];
  let mockAuditEventsData: any[] = [];
  let mockOddsHistoryData: any[] = [];
  let mockPredictionResultsData: any[] = [];

  beforeEach(() => {
    vi.resetAllMocks();

    mockSignalsData = [];
    mockMatchesData = [];
    mockAuditEventsData = [];
    mockOddsHistoryData = [];
    mockPredictionResultsData = [];

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

    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      mockChainObj._currentTable = table;
      return mockChainObj;
    });

    // Mock resolution logic for Supabase queries
    then.mockImplementation((resolve) => {
      if (resolve && typeof resolve === 'function') {
        let responseData: any[] = [];
        if (mockChainObj._currentTable === 'signals') {
          responseData = mockSignalsData;
        } else if (mockChainObj._currentTable === 'matches') {
          responseData = mockMatchesData;
        } else if (mockChainObj._currentTable === 'signal_audit_events') {
          responseData = mockAuditEventsData;
        } else if (mockChainObj._currentTable === 'odds_history') {
          responseData = mockOddsHistoryData;
        } else if (mockChainObj._currentTable === 'prediction_results') {
          responseData = mockPredictionResultsData;
        }
        resolve({ data: responseData, error: null });
      }
    });

    maybeSingle.mockImplementation(() => {
      if (mockChainObj._currentTable === 'signals') {
        return Promise.resolve({ data: mockSignalsData[0] || null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  describe('Signal Metrics Append-Only Snapshots', () => {
    it('should save multiple metrics records using insert on signal scanner write', async () => {
      mockSignalsData = [
        { id: 'sig_hist_1', match_id: 'match_123', market: 'asian_handicap', handicap_line: -0.5, selection: 'home', odds: 1.95, confidence: 0.80 }
      ];
      mockChainObj.upsert = vi.fn().mockReturnValue(mockChainObj);

      const picks = [
        {
          matchId: 'match_123',
          marketType: 'AH' as const,
          line: '-0.5',
          outcome: 'home' as const,
          modelProbability: 0.60,
          marketOdds: 1.95,
          impliedProbability: 0.51,
          expectedValue: 0.20,
          kellyStake: 0.10,
          clv: 0.05,
          confidence: 0.80,
          tier: 'ELITE' as const
        }
      ];

      await SignalScanner.saveSignals(picks, {
        league: 'EPL',
        home_team: 'Chelsea',
        away_team: 'Arsenal',
        kickoff_utc: new Date().toISOString()
      });

      expect(supabase.from).toHaveBeenCalledWith('signal_metrics');
      expect(insert).toHaveBeenCalled();
      // Ensure it does not call upsert on metrics
      expect(mockChainObj.upsert).not.toHaveBeenCalledWith(expect.objectContaining({
        signal_id: 'sig_hist_1'
      }), expect.anything());
    });
  });

  describe('Market Taxonomy Mapping', () => {
    it('should correctly set market_category and market_selection for AH', async () => {
      mockSignalsData = [
        { id: 'sig_tax_1', match_id: 'match_123', market: 'asian_handicap', handicap_line: -0.75, selection: 'home', odds: 1.95 }
      ];
      mockChainObj.upsert = vi.fn().mockReturnValue(mockChainObj);

      const picks = [
        {
          matchId: 'match_123',
          marketType: 'AH' as const,
          line: '-0.75',
          outcome: 'home' as const,
          modelProbability: 0.60,
          marketOdds: 1.95,
          impliedProbability: 0.51,
          expectedValue: 0.20,
          kellyStake: 0.10,
          clv: 0.05,
          confidence: 0.80,
          tier: 'ELITE' as const
        }
      ];

      await SignalScanner.saveSignals(picks, {
        league: 'EPL',
        home_team: 'Chelsea',
        away_team: 'Arsenal',
        kickoff_utc: new Date().toISOString()
      });

      expect(mockChainObj.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            market_category: 'asian_handicap',
            market_selection: 'home_-0.75'
          })
        ]),
        expect.any(Object)
      );
    });
  });

  describe('Data Quality Confidence Layer', () => {
    it('should classify confidence as LOW for small samples (<30)', async () => {
      mockSignalsData = new Array(25).fill({
        id: 'sig_id',
        match_id: 'match_123',
        correlation_id: 'corr_123'
      });
      mockMatchesData = [{ id: 'match_123' }];

      const report = await DataQualityEngine.evaluate();
      expect(report.sample_size).toBe(25);
      expect(report.confidence_level).toBe('LOW');
    });

    it('should classify confidence as MEDIUM for medium samples (30-100)', async () => {
      mockSignalsData = new Array(50).fill({
        id: 'sig_id',
        match_id: 'match_123',
        correlation_id: 'corr_123'
      });
      mockMatchesData = [{ id: 'match_123' }];

      const report = await DataQualityEngine.evaluate();
      expect(report.sample_size).toBe(50);
      expect(report.confidence_level).toBe('MEDIUM');
    });

    it('should classify confidence as HIGH for large samples (>100)', async () => {
      mockSignalsData = new Array(120).fill({
        id: 'sig_id',
        match_id: 'match_123',
        correlation_id: 'corr_123'
      });
      mockMatchesData = [{ id: 'match_123' }];

      const report = await DataQualityEngine.evaluate();
      expect(report.sample_size).toBe(120);
      expect(report.confidence_level).toBe('HIGH');
    });
  });

  describe('Performance API Market Filtering', () => {
    it('should filter signals correctly when market query parameter is provided', async () => {
      mockSignalsData = [
        { id: 'sig_f1', status: 'won', odds: 2.0, market: 'asian_handicap', settled_at: new Date().toISOString() },
        { id: 'sig_f2', status: 'lost', odds: 1.8, market: 'over_under', settled_at: new Date().toISOString() }
      ];

      const request = new Request('http://localhost/api/stats/performance?market=asian_handicap');
      const response = await performanceGET(request);
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.settledCount).toBe(1);
      expect(payload.ROI).toBe(100.0);
    });
  });

  describe('Bankroll Simulation Engine', () => {
    it('should accurately simulate flat stake bankroll progression', () => {
      const mockSignals = [
        { status: 'won', odds: 2.0 },
        { status: 'lost', odds: 1.8 }
      ];

      const res = simulateBankroll(mockSignals, 1000, 'flat', 50);

      // Won: stake 50 at odds 2.0 -> profit +50 -> balance 1050
      // Lost: stake 50 -> profit -50 -> balance 1000
      expect(res.ending_balance).toBe(1000.0);
      expect(res.profit).toBe(0.0);
      expect(res.ROI).toBe(0.0);
      expect(res.max_drawdown).toBeCloseTo(0.0476); // peak 1050, final 1000 -> (1050-1000)/1050 = 4.76%
    });

    it('should accurately simulate percentage stake bankroll progression', () => {
      const mockSignals = [
        { status: 'won', odds: 2.0 },
        { status: 'lost', odds: 2.0 }
      ];

      const res = simulateBankroll(mockSignals, 1000, 'percentage', 0.10);

      // Round 1: stake 10% of 1000 = 100 -> won (odds 2.0) -> profit +100 -> balance 1100
      // Round 2: stake 10% of 1100 = 110 -> lost -> profit -110 -> balance 990
      expect(res.ending_balance).toBe(990.0);
      expect(res.profit).toBe(-10.0);
      expect(res.ROI).toBe(-4.76); // profit -10 / total stake (100+110) * 100 = -4.7619%
    });
  });
});
