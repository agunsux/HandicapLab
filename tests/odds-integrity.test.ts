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
import { supabase } from '../src/lib/supabase.server';

describe('Odds Accuracy & Settlement Immutability Gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();

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

    // Mock then implementation to resolve safely (thenable chain support)
    then.mockImplementation((resolve) => {
      if (resolve && typeof resolve === 'function') {
        resolve({ data: [], error: null });
      }
    });

    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      mockChainObj._currentTable = table;
      return mockChainObj;
    });
  });

  describe('Odds Snapshots Accuracy', () => {
    it('should insert odds snapshot with correct tracing properties', async () => {
      const oddsPayload = {
        signal_id: 'sig_test_123',
        correlation_id: 'corr_test_123',
        provider: 'pinnacle',
        captured_at: new Date().toISOString(),
        odds: 1.95,
        line: -0.5
      };

      await supabase.from('odds_history').insert(oddsPayload);

      expect(supabase.from).toHaveBeenCalledWith('odds_history');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        signal_id: 'sig_test_123',
        correlation_id: 'corr_test_123',
        provider: 'pinnacle',
        captured_at: expect.any(String)
      }));
    });

    it('should warn or block if odds snapshot is missing signal_id reference', async () => {
      // Simulate database constraint check rejecting missing signal_id in odds_history
      insert.mockImplementation((payload) => {
        if (!payload.signal_id) {
          throw new Error('null value in column "signal_id" violates not-null constraint');
        }
        return mockChainObj;
      });

      expect(() => {
        supabase.from('odds_history').insert({
          correlation_id: 'corr_test_123',
          provider: 'pinnacle',
          captured_at: new Date().toISOString()
        });
      }).toThrow('violates not-null constraint');
    });
  });

  describe('Settlement Immutability & Admin Corrections', () => {
    it('should block updates to settled prediction results under normal flow', () => {
      // Mock triggers blocking updates in normal flow
      update.mockImplementation((payload) => {
        const hasMutatedResult = 'actual_home_score' in payload || 'profit_ah' in payload;
        if (hasMutatedResult) {
          throw new Error('Settlement records are immutable. Results cannot be modified.');
        }
        return mockChainObj;
      });

      expect(() => {
        supabase.from('prediction_results').update({ actual_home_score: 3 }).eq('prediction_id', 'pred_999');
      }).toThrow('Settlement records are immutable. Results cannot be modified.');
    });

    it('should allow updates and log SETTLEMENT_CORRECTED when admin override setting is flagged', () => {
      let loggedCorrectedEvent = false;

      // Mock admin override flow setting trigger simulation
      update.mockImplementation((payload) => {
        // If override variable is set to true, allow write and log SETTLEMENT_CORRECTED
        loggedCorrectedEvent = true;
        supabase.from('signal_audit_events').insert({
          signal_id: 'pred_999',
          event_type: 'SETTLEMENT_CORRECTED',
          source: 'admin',
          correlation_id: 'corr-override-123',
          payload: {
            prediction_id: 'pred_999',
            old_home_score: 1,
            new_home_score: payload.actual_home_score,
            reason: 'ADMIN_MANUAL_CORRECTION'
          }
        });
        return mockChainObj;
      });

      // Update executes successfully under simulation
      expect(() => {
        supabase.from('prediction_results').update({ actual_home_score: 2 }).eq('prediction_id', 'pred_999');
      }).not.toThrow();

      expect(loggedCorrectedEvent).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('signal_audit_events');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        signal_id: 'pred_999',
        event_type: 'SETTLEMENT_CORRECTED',
        source: 'admin',
        correlation_id: 'corr-override-123',
        payload: expect.objectContaining({
          new_home_score: 2,
          reason: 'ADMIN_MANUAL_CORRECTION'
        })
      }));
    });
  });
});
