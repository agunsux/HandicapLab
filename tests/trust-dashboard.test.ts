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
  limit,
  inMock
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
  const inMock = vi.fn();

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
    limit,
    in: inMock
  };

  select.mockReturnValue(mockChainObj);
  eq.mockReturnValue(mockChainObj);
  maybeSingle.mockReturnValue(mockChainObj);
  single.mockReturnValue(mockChainObj);
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
  inMock.mockReturnValue(mockChainObj);

  const mockSupabase = {
    from: vi.fn(() => mockChainObj),
    rpc
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
    limit,
    inMock
  };
});

// Mock Supabase Server Client
vi.mock('@/lib/supabase.server', () => ({
  supabase: mockSupabase
}));

// Mock Entitlements checking helper
const mockEntitlement = vi.hoisted(() => ({ active: false, tier: 'FREE' }));
vi.mock('../src/lib/payments/entitlement/check', () => ({
  checkActiveEntitlement: vi.fn().mockImplementation(async () => mockEntitlement.active)
}));

// Mock Data
let mockSignalsData: any[] = [];

import { GET as feedGET } from '../src/app/api/signals/feed/route';
import { GET as performanceGET } from '../src/app/api/stats/performance/route';

describe('Trust Dashboard & Proof Layer Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlement.active = false;
    mockEntitlement.tier = 'FREE';
    mockSignalsData = [];

    // Setup default chain mock resolutions
    select.mockReturnValue(mockChainObj);
    eq.mockReturnValue(mockChainObj);
    not.mockReturnValue(mockChainObj);
    order.mockReturnValue(mockChainObj);

    // Dynamic mock response based on DB query
    mockChainObj.then = (onfulfilled: any) => {
      return Promise.resolve(onfulfilled({ data: mockSignalsData, error: null }));
    };
  });

  describe('GET /api/signals/feed (Track Record queries)', () => {
    it('should correctly query only settled predictions when status=SETTLED is passed', async () => {
      mockSignalsData = [
        {
          id: '11111111-2222-3333-4444-555555555555',
          home_team: 'Inter',
          away_team: 'Milan',
          status: 'won',
          odds: 1.90,
          closing_odds: 1.80,
          clv_percentage: 2.7,
          confidence: 0.8,
          market: 'asian_handicap',
          market_category: 'asian_handicap',
          market_selection: 'home_-0.5'
        }
      ];

      const request = new Request('http://localhost/api/signals/feed?status=SETTLED&market=AH');
      const response = await feedGET(request);
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.feed).toHaveLength(1);
      expect(payload.feed[0].status).toBe('won');
      expect(not).toHaveBeenCalledWith('status', 'in', '("OPEN", "LOCKED", "DRAFT", "pending", "settling", "LIVE")');
    });

    it('should apply premium masking on track record items for free tier users', async () => {
      mockSignalsData = [
        {
          id: '11111111-2222-3333-4444-555555555555',
          home_team: 'Inter',
          away_team: 'Milan',
          status: 'won',
          odds: 1.90,
          closing_odds: 1.80,
          clv_percentage: 2.7,
          confidence: 0.8,
          market: 'asian_handicap',
          market_category: 'asian_handicap',
          market_selection: 'home_-0.5'
        }
      ];

      mockEntitlement.active = false;
      mockEntitlement.tier = 'FREE';

      const request = new Request('http://localhost/api/signals/feed?status=SETTLED&market=AH');
      const response = await feedGET(request);
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.is_premium).toBe(false);
      expect(payload.feed[0].current_odds).toBeNull();
      expect(payload.feed[0].clv_percentage).toBeNull();
    });

    it('should reveal complete track record information for premium accounts', async () => {
      mockSignalsData = [
        {
          id: '11111111-2222-3333-4444-555555555555',
          home_team: 'Inter',
          away_team: 'Milan',
          status: 'won',
          odds: 1.90,
          closing_odds: 1.80,
          clv_percentage: 2.7,
          confidence: 0.8,
          market: 'asian_handicap',
          market_category: 'asian_handicap',
          market_selection: 'home_-0.5'
        }
      ];

      mockEntitlement.active = true;
      mockEntitlement.tier = 'PRO';

      const request = new Request('http://localhost/api/signals/feed?status=SETTLED&market=AH', {
        headers: { 'x-user-id': 'premium-user-id' }
      });
      const response = await feedGET(request);
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.is_premium).toBe(true);
      expect(payload.feed[0].current_odds).toBe(1.80);
      expect(payload.feed[0].clv_percentage).toBe(2.7);
    });
  });

  describe('GET /api/stats/performance', () => {
    it('should retrieve overall statistics correctly', async () => {
      mockSignalsData = [
        {
          id: '11111111-2222-3333-4444-555555555555',
          home_team: 'Inter',
          away_team: 'Milan',
          status: 'won',
          odds: 2.00,
          closing_odds: 1.80,
          clv_percentage: 2.7,
          confidence: 0.8,
          market: 'asian_handicap',
          market_category: 'asian_handicap',
          market_selection: 'home_-0.5',
          profit_loss: 1.0,
          settled_at: new Date().toISOString()
        }
      ];

      const request = new Request('http://localhost/api/stats/performance');
      const response = await performanceGET(request);
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.settledCount).toBe(1);
      expect(payload.winRate).toBe(100);
      expect(payload.roi).toBe(100);
    });
  });
});
