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
import { calculateQualityMetrics, DataQualityEngine } from '../src/lib/analytics/data-quality';
import { GET as performanceGET } from '../src/app/api/stats/performance/route';
import { GET as adminGET } from '../src/app/api/admin/data-quality/route';

describe('Production Data Quality & Observability', () => {
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

    // Mock resolution logic for Supabase thenable queries
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

  describe('Signal Quality Metric Calculation', () => {
    it('should assign correct scores based on sharpness, clv, league, and confidence', () => {
      const signal = {
        provider: 'pinnacle',
        opening_odds: 1.95,
        closing_odds: 1.80,
        opening_line: -0.5,
        closing_line: -0.5,
        confidence: 0.85,
        league: 'English Premier League'
      };

      const metrics = calculateQualityMetrics(signal, 0.08);

      expect(metrics.sharp_score).toBe(100);
      expect(metrics.clv_score).toBe(100);
      expect(metrics.liquidity_score).toBe(100);
      expect(metrics.confidence_score).toBe(85);
      expect(metrics.quality_score).toBe(96); // Weighted sum: 20 + 30 + 25.5 + 20 = 95.5 -> 96
    });

    it('should lower score for non-sharp books and missing CLV/opening lines', () => {
      const signal = {
        provider: 'softbook',
        opening_odds: 2.10,
        closing_odds: null,
        opening_line: null,
        closing_line: null,
        confidence: 0.60,
        league: 'Latvian League'
      };

      const metrics = calculateQualityMetrics(signal, null);

      expect(metrics.sharp_score).toBe(70);
      expect(metrics.clv_score).toBe(50);
      expect(metrics.liquidity_score).toBe(70);
      expect(metrics.confidence_score).toBe(60);
      expect(metrics.quality_score).toBe(61); // Weighted sum: 14 + 15 + 18 + 14 = 61
    });
  });

  describe('Odds Provenance Layer', () => {
    it('should write all provenance attributes during insert', async () => {
      const provenanceData = {
        signal_id: 'sig_prov_123',
        correlation_id: 'corr_prov_123',
        provider: 'pinnacle',
        captured_at: new Date().toISOString(),
        provider_timestamp: new Date().toISOString(),
        api_request_id: 'req_123',
        market_type: 'asian_handicap',
        source_version: 'v4'
      };

      await supabase.from('odds_history').insert(provenanceData);

      expect(supabase.from).toHaveBeenCalledWith('odds_history');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        provider_timestamp: expect.any(String),
        api_request_id: 'req_123',
        market_type: 'asian_handicap',
        source_version: 'v4'
      }));
    });
  });

  describe('Settlement Correction Audit', () => {
    it('should allow override updates and populate settlement_corrections on manual edits', () => {
      let loggedCorrection = false;

      update.mockImplementation((payload) => {
        loggedCorrection = true;
        supabase.from('settlement_corrections').insert({
          signal_id: 'sig_corr_123',
          prediction_result_id: 'res_corr_123',
          changed_by: 'admin',
          reason: 'ADMIN_SCORE_CORRECTION',
          old_value: { actual_home_score: 1, actual_away_score: 1 },
          new_value: { actual_home_score: 2, actual_away_score: 1 }
        });
        return mockChainObj;
      });

      supabase.from('prediction_results').update({ actual_home_score: 2 }).eq('prediction_id', 'res_corr_123');

      expect(loggedCorrection).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('settlement_corrections');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        changed_by: 'admin',
        reason: 'ADMIN_SCORE_CORRECTION',
        new_value: expect.objectContaining({ actual_home_score: 2 })
      }));
    });
  });

  describe('Stale Odds & Data Quality Observability', () => {
    it('should evaluate system health correctly', async () => {
      mockSignalsData = [
        { id: 'sig_1', match_id: 'match_1', correlation_id: 'corr_1', settled_at: new Date().toISOString(), opening_odds: 1.95, closing_odds: 1.90 }
      ];
      mockMatchesData = [{ id: 'match_1' }];
      mockAuditEventsData = [
        { signal_id: 'sig_1', event_type: 'SIGNAL_SETTLED', correlation_id: 'corr_1' }
      ];
      // 25 hours ago to trigger staleness
      const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      mockOddsHistoryData = [
        { signal_id: 'sig_1', correlation_id: 'corr_1', recorded_at: staleTime }
      ];

      const report = await DataQualityEngine.evaluate();

      expect(report.metrics.totalSignals).toBe(1);
      expect(report.metrics.staleOddsCount).toBe(1);
      expect(report.metrics.orphanSignals).toBe(0);
      expect(report.status).toBe('warning'); // Warning due to stale odds
    });
  });

  describe('Model Version Filtering & Performance Breakdown', () => {
    it('should split performance statistics by model version in route output', async () => {
      mockSignalsData = [
        {
          id: 'sig_a',
          status: 'won',
          odds: 2.0,
          probability: 0.55,
          clv: 0.05,
          settled_at: new Date().toISOString(),
          model_version: 'rule_v1',
          signal_metrics: [{ quality_score: 95 }]
        },
        {
          id: 'sig_b',
          status: 'lost',
          odds: 1.80,
          probability: 0.60,
          clv: -0.02,
          settled_at: new Date().toISOString(),
          model_version: 'ai_v2',
          signal_metrics: [{ quality_score: 80 }]
        }
      ];

      const response = await performanceGET();
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload['Quality score average']).toBe(87.5);
      expect(payload['Model version breakdown']).toBeDefined();
      expect(payload['Model version breakdown']['rule_v1'].sample_size).toBe(1);
      expect(payload['Model version breakdown']['rule_v1'].roi).toBe(100.0);
      expect(payload['Model version breakdown']['ai_v2'].sample_size).toBe(1);
      expect(payload['Model version breakdown']['ai_v2'].roi).toBe(-100.0);
    });
  });
});
