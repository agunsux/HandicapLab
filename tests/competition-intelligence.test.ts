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
const mockEntitlement = vi.hoisted(() => ({ active: false }));
vi.mock('../src/lib/payments/entitlement/check', () => ({
  checkActiveEntitlement: async () => mockEntitlement.active
}));

// Mock Data
let mockSignalsData: any[] = [];

import { GET as feedGET } from '../src/app/api/signals/feed/route';

describe('Phase 32.7 — Competition Intelligence Layer Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlement.active = true; // Make it premium by default to prevent masking during sorting audits
    mockSignalsData = [];

    select.mockReturnValue(mockChainObj);
    eq.mockReturnValue(mockChainObj);
    not.mockReturnValue(mockChainObj);
    order.mockReturnValue(mockChainObj);

    mockChainObj.then = (onfulfilled: any) => {
      return Promise.resolve(onfulfilled({ data: mockSignalsData, error: null }));
    };
  });

  it('should calculate priority score correctly for Tier 1 high liquidity leagues', async () => {
    mockSignalsData = [
      {
        id: '11111111-2222-3333-4444-555555555555',
        home_team: 'Chelsea',
        away_team: 'Arsenal',
        league: 'Premier League', // Tier 1, Liquidity: 100
        edge_pct: 5.0, // edge_score = 50
        confidence: 0.8, // confidence_score = 80
        status: 'OPEN',
        odds: 1.85,
        market_category: 'asian_handicap',
        market_selection: 'home_-0.5'
      }
    ];

    const request = new Request('http://localhost/api/signals/feed?market=AH');
    const response = await feedGET(request);
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.feed).toHaveLength(1);
    
    // priority_score = (50 * 0.5) + (80 * 0.3) + (100 * 0.2) = 25 + 24 + 20 = 69
    expect(payload.feed[0].priority_score).toBe(69);
    expect(payload.feed[0].competition.country).toBe('England');
    expect(payload.feed[0].competition.tier).toBe(1);
  });

  it('should rank high-edge lower tier leagues above low-edge high tier leagues', async () => {
    mockSignalsData = [
      {
        id: 'epl-signal',
        home_team: 'Chelsea',
        away_team: 'Arsenal',
        league: 'Premier League', // Tier 1, Liquidity: 100
        edge_pct: 1.0, // edge_score = 10
        confidence: 0.5, // confidence_score = 50
        status: 'OPEN',
        odds: 1.85,
        market_category: 'asian_handicap',
        market_selection: 'home_-0.5'
      },
      {
        id: 'ligue2-signal',
        home_team: 'Metz',
        away_team: 'Red Star',
        league: 'Ligue 2', // Tier 3, Liquidity: 30
        edge_pct: 15.0, // edge_score = 100 (capped)
        confidence: 0.8, // confidence_score = 80
        status: 'OPEN',
        odds: 2.10,
        market_category: 'asian_handicap',
        market_selection: 'home_-0.25'
      }
    ];

    const request = new Request('http://localhost/api/signals/feed?market=AH');
    const response = await feedGET(request);
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.feed).toHaveLength(2);

    // epl priority_score = (10 * 0.5) + (50 * 0.3) + (100 * 0.2) = 5 + 15 + 20 = 40
    // ligue2 priority_score = (100 * 0.5) + (80 * 0.3) + (30 * 0.2) = 50 + 24 + 6 = 80
    // So Metz vs Red Star (Ligue 2) should be sorted first despite being Tier 3!
    expect(payload.feed[0].id).toBe('ligue2-signal');
    expect(payload.feed[1].id).toBe('epl-signal');
  });

  it('should apply filters for country, league, and confidence correctly', async () => {
    mockSignalsData = [
      {
        id: '1',
        home_team: 'Chelsea',
        away_team: 'Arsenal',
        league: 'Premier League',
        edge_pct: 5.0,
        confidence: 0.8, // HIGH
        status: 'OPEN',
        odds: 1.85,
        market_category: 'asian_handicap',
        market_selection: 'home_-0.5'
      },
      {
        id: '2',
        home_team: 'Metz',
        away_team: 'Red Star',
        league: 'Ligue 2',
        edge_pct: 4.0,
        confidence: 0.3, // LOW
        status: 'OPEN',
        odds: 2.10,
        market_category: 'asian_handicap',
        market_selection: 'home_-0.25'
      }
    ];

    // Filter by country
    const reqCountry = new Request('http://localhost/api/signals/feed?market=AH&country=France');
    const resCountry = await feedGET(reqCountry);
    const payCountry = await resCountry.json();
    expect(payCountry.feed).toHaveLength(1);
    expect(payCountry.feed[0].id).toBe('2');

    // Filter by confidence
    const reqConfidence = new Request('http://localhost/api/signals/feed?market=AH&confidence=HIGH');
    const resConfidence = await feedGET(reqConfidence);
    const payConfidence = await resConfidence.json();
    expect(payConfidence.feed).toHaveLength(1);
    expect(payConfidence.feed[0].id).toBe('1');
  });
});
