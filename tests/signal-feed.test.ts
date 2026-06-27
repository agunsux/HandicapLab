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
    limit,
    inMock
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

// Mock checkActiveEntitlement
const mockEntitlement = vi.hoisted(() => ({ active: false }));
vi.mock('../src/lib/payments/entitlement/check', () => {
  return {
    checkActiveEntitlement: async () => mockEntitlement.active
  };
});
vi.mock('../payments/entitlement/check', () => {
  return {
    checkActiveEntitlement: async () => mockEntitlement.active
  };
});
vi.mock('@/lib/payments/entitlement/check', () => {
  return {
    checkActiveEntitlement: async () => mockEntitlement.active
  };
});

import { supabase } from '../src/lib/supabase.server';
import { GET as feedGET } from '../src/app/api/signals/feed/route';
import { GET as detailGET } from '../src/app/api/signals/[id]/route';

describe('Signal Delivery Layer (Phase 32)', () => {
  let mockSignalsData: any[] = [];
  let mockEntitlementsData: any[] = [];

  beforeEach(() => {
    vi.resetAllMocks();
    mockEntitlement.active = false;

    mockSignalsData = [];
    mockEntitlementsData = [];

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
    inMock.mockReturnValue(mockChainObj);

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
        } else if (mockChainObj._currentTable === 'user_entitlements') {
          responseData = mockEntitlementsData;
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

  describe('GET /api/signals/feed', () => {
    it('should return only published signals with status OPEN or LOCKED', async () => {
      mockSignalsData = [
        { id: 'sig_1', home_team: 'Chelsea', away_team: 'Arsenal', market_category: 'asian_handicap', status: 'OPEN', confidence: 0.8 },
        { id: 'sig_2', home_team: 'Man City', away_team: 'Spurs', market_category: 'asian_handicap', status: 'LOCKED', confidence: 0.6 }
      ];

      const request = new Request('http://localhost/api/signals/feed');
      const response = await feedGET(request);
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.feed).toHaveLength(2);
      expect(payload.feed[0].status).toBe('OPEN');
      expect(payload.feed[1].status).toBe('LOCKED');
    });

    it('should filter signals by market parameter (OU)', async () => {
      mockSignalsData = [
        { id: 'sig_ou_1', home_team: 'Man United', away_team: 'Liverpool', market_category: 'over_under', status: 'OPEN', confidence: 0.75 }
      ];

      const request = new Request('http://localhost/api/signals/feed?market=OU');
      const response = await feedGET(request);
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.feed).toHaveLength(1);
      expect(payload.feed[0].market_category).toBe('over_under');
    });

    it('should enforce pagination limit parameter', async () => {
      mockSignalsData = [
        { id: 'sig_1', status: 'OPEN' },
        { id: 'sig_2', status: 'OPEN' },
        { id: 'sig_3', status: 'OPEN' }
      ];
      // For premium user (mocked as premium to avoid free user slice of 3)
      mockEntitlement.active = true;

      const request = new Request('http://localhost/api/signals/feed?limit=2', {
        headers: { 'x-user-id': 'premium_user' }
      });
      const response = await feedGET(request);
      const payload = await response.json();

      expect(payload.feed).toHaveLength(2);
    });

    it('should hide/mask premium fields and slice feed count to 3 for free users', async () => {
      mockSignalsData = [
        { id: 'sig_1', status: 'OPEN', edge_pct: 12.5, closing_odds: 1.85, clv_percentage: 4.5 },
        { id: 'sig_2', status: 'OPEN' },
        { id: 'sig_3', status: 'OPEN' },
        { id: 'sig_4', status: 'OPEN' }
      ];
      mockEntitlement.active = false; // Free User

      const request = new Request('http://localhost/api/signals/feed');
      const response = await feedGET(request);
      const payload = await response.json();

      expect(payload.is_premium).toBe(false);
      expect(payload.feed).toHaveLength(3); // Enforce 3 limit
      expect(payload.feed[0].edge_percentage).toBeNull();
      expect(payload.feed[0].current_odds).toBeNull();
    });

    it('should show all data for premium users', async () => {
      mockSignalsData = [
        { id: 'sig_1', status: 'OPEN', edge_pct: 12.5, closing_odds: 1.85 }
      ];
      mockEntitlement.active = true; // Premium User

      const request = new Request('http://localhost/api/signals/feed', {
        headers: { 'x-user-id': 'premium_user' }
      });
      const response = await feedGET(request);
      const payload = await response.json();

      expect(payload.is_premium).toBe(true);
      expect(payload.feed[0].edge_percentage).toBe(12.5);
      expect(payload.feed[0].current_odds).toBe(1.85);
    });
  });

  describe('GET /api/signals/[id]', () => {
    it('should return bad request for invalid UUID', async () => {
      const request = new Request('http://localhost/api/signals/invalid-id');
      const response = await detailGET(request, { params: Promise.resolve({ id: 'invalid-id' }) });
      expect(response.status).toBe(400);
    });

    it('should mask details for free users on detailed query', async () => {
      const validUuid = '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
      mockSignalsData = [
        {
          id: validUuid,
          home_team: 'Chelsea',
          away_team: 'Arsenal',
          edge_pct: 10.5,
          clv_percentage: 2.1
        }
      ];
      mockEntitlement.active = false;

      const request = new Request(`http://localhost/api/signals/${validUuid}`);
      const response = await detailGET(request, { params: Promise.resolve({ id: validUuid }) });
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.data.prediction.edge).toBeNull();
      expect(payload.data.market_movement.clv).toBeNull();
    });
  });
});
