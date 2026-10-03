import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as ahGET } from '@/app/api/v1/markets/asian-handicap/route';
import { GET as ouGET } from '@/app/api/v1/markets/over-under/route';
import { GET as bttsGET } from '@/app/api/v1/markets/btts/route';
import { supabase } from '@/lib/supabase.server';
import { FREE_VISIBLE_SIGNALS } from '@/config/entitlements';

const createMockChain = (data: any[] = [], error: any = null) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve({ data, error }),
  };
  return chain;
};

vi.mock('@/lib/supabase.server', () => {
  return {
    supabase: {
      from: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    },
  };
});

vi.mock('@/lib/pricing/entitlement', () => {
  return {
    getUserEntitlements: vi.fn().mockResolvedValue({ hasFullEdgeData: false }),
  };
});

describe('Public Market API Projection (daily_picks)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AH route queries daily_picks with market_type in [ASIAN_HANDICAP, AH] and preserves quarter lines', async () => {
    const mockRow = {
      id: 'pick-ah-1',
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      league: 'Premier League',
      kickoff_utc: '2026-10-09T15:00:00Z',
      market_type: 'ASIAN_HANDICAP',
      prediction: 'Arsenal -0.25',
      model_probability: 0.65,
      fair_odds: 1.54,
      market_odds: 1.95,
      edge_pct: 7.25,
      reasoning: JSON.stringify({ line: -0.25, bookmaker: 'pinnacle' }),
    };

    const chain = createMockChain([mockRow]);
    vi.mocked(supabase.from).mockReturnValue(chain);

    const req = new Request('http://localhost/api/v1/markets/asian-handicap?date=all');
    const res = await ahGET(req);
    const json = await res.json();

    expect(supabase.from).toHaveBeenCalledWith('daily_picks');
    expect(chain.in).toHaveBeenCalledWith('market_type', ['ASIAN_HANDICAP', 'AH']);
    expect(chain.order).toHaveBeenCalledWith('edge_pct', { ascending: false });
    expect(json.success).toBe(true);
    expect(json.count).toBe(1);
    expect(json.data[0]).toMatchObject({
      id: 'pick-ah-1',
      home: 'Arsenal',
      away: 'Chelsea',
      league: 'Premier League',
      kickoff: '2026-10-09T15:00:00Z',
      market: 'AH',
      selection: 'Arsenal -0.25',
      line: -0.25, // Quarter line preserved
      modelProb: 0.65,
      marketOdds: 1.95,
      fairOdds: 1.54,
      ev: 0.0725,
      tier: 'FREE',
      locked: false,
    });
  });

  it('OU route queries daily_picks with market_type in [OVER_UNDER, OU] and preserves quarter line (e.g. 2.75)', async () => {
    const mockRow = {
      id: 'pick-ou-1',
      home_team: 'Liverpool',
      away_team: 'Everton',
      league: 'Premier League',
      kickoff_utc: '2026-10-09T17:30:00Z',
      market_type: 'OVER_UNDER',
      prediction: 'Over 2.75',
      model_probability: 0.58,
      fair_odds: 1.72,
      market_odds: 1.92,
      edge_pct: 4.10,
      reasoning: JSON.stringify({ line: 2.75, bookmaker: 'pinnacle' }),
    };

    const chain = createMockChain([mockRow]);
    vi.mocked(supabase.from).mockReturnValue(chain);

    const req = new Request('http://localhost/api/v1/markets/over-under?date=all');
    const res = await ouGET(req);
    const json = await res.json();

    expect(supabase.from).toHaveBeenCalledWith('daily_picks');
    expect(chain.in).toHaveBeenCalledWith('market_type', ['OVER_UNDER', 'OU']);
    expect(json.success).toBe(true);
    expect(json.count).toBe(1);
    expect(json.data[0]).toMatchObject({
      id: 'pick-ou-1',
      home: 'Liverpool',
      away: 'Everton',
      market: 'OU',
      selection: 'Over 2.75',
      line: 2.75, // Quarter line preserved
      modelProb: 0.58,
      ev: 0.041,
    });
  });

  it('BTTS route queries daily_picks with market_type eq BTTS', async () => {
    const mockRow = {
      id: 'pick-btts-1',
      home_team: 'Real Madrid',
      away_team: 'Barcelona',
      league: 'La Liga',
      kickoff_utc: '2026-10-09T20:00:00Z',
      market_type: 'BTTS',
      prediction: 'Yes',
      model_probability: 0.62,
      fair_odds: 1.61,
      market_odds: 1.88,
      edge_pct: 6.50,
      reasoning: JSON.stringify({ bookmaker: 'pinnacle' }),
    };

    const chain = createMockChain([mockRow]);
    vi.mocked(supabase.from).mockReturnValue(chain);

    const req = new Request('http://localhost/api/v1/markets/btts?date=all');
    const res = await bttsGET(req);
    const json = await res.json();

    expect(supabase.from).toHaveBeenCalledWith('daily_picks');
    expect(chain.eq).toHaveBeenCalledWith('market_type', 'BTTS');
    expect(json.success).toBe(true);
    expect(json.count).toBe(1);
    expect(json.data[0]).toMatchObject({
      id: 'pick-btts-1',
      home: 'Real Madrid',
      away: 'Barcelona',
      market: 'BTTS',
      selection: 'Yes',
      modelProb: 0.62,
      fairOdds: 1.61,
      ev: 0.065,
    });
  });

  it('correctly handles zero-result scenarios when no matching rows exist', async () => {
    const chain = createMockChain([]);
    vi.mocked(supabase.from).mockReturnValue(chain);

    const req = new Request('http://localhost/api/v1/markets/asian-handicap?date=all');
    const res = await ahGET(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.count).toBe(0);
    expect(json.data).toEqual([]);
  });

  it('preserves freemium masking beyond FREE_VISIBLE_SIGNALS without leaking odds or EV', async () => {
    const mockRows = Array.from({ length: 5 }, (_, i) => ({
      id: `pick-${i}`,
      home_team: `Home ${i}`,
      away_team: `Away ${i}`,
      league: 'Premier League',
      kickoff_utc: '2026-10-09T15:00:00Z',
      market_type: 'ASIAN_HANDICAP',
      prediction: `Home ${i} -0.5`,
      model_probability: 0.60,
      fair_odds: 1.67,
      market_odds: 1.95,
      edge_pct: 5.0,
      reasoning: JSON.stringify({ line: -0.5 }),
    }));

    const chain = createMockChain(mockRows);
    vi.mocked(supabase.from).mockReturnValue(chain);

    const req = new Request('http://localhost/api/v1/markets/asian-handicap?date=all');
    const res = await ahGET(req);
    const json = await res.json();

    expect(json.count).toBe(5);
    for (let i = 0; i < FREE_VISIBLE_SIGNALS; i++) {
      expect(json.data[i].locked).toBe(false);
      expect(json.data[i].modelProb).toBeDefined();
      expect(json.data[i].ev).toBeDefined();
    }
    for (let i = FREE_VISIBLE_SIGNALS; i < mockRows.length; i++) {
      expect(json.data[i].locked).toBe(true);
      expect(json.data[i].modelProb).toBeUndefined();
      expect(json.data[i].ev).toBeUndefined();
      expect(json.data[i].marketOdds).toBeUndefined();
    }
  });
});
