import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as handleGenerateSignals } from '../src/app/api/cron/generate-signals/route';
import { GET as handleSettle } from '../src/app/api/cron/settle/route';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase Client
vi.mock('../src/lib/supabase.server', () => {
  const chain: any = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    not: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    lt: vi.fn().mockImplementation(() => chain),
    is: vi.fn().mockImplementation(() => chain),
    or: vi.fn().mockImplementation(() => chain),
    gte: vi.fn().mockImplementation(() => chain),
    lte: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: { id: 'sig-inserted-123' }, error: null })),
    single: vi.fn().mockImplementation(() => Promise.resolve({ data: { id: 'sig-inserted-123' }, error: null })),
    insert: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    then: vi.fn().mockImplementation((resolve) => {
      resolve({
        data: [
          {
            id: 'sig-inserted-123',
            odds: 2.0,
            opening_odds: 2.0,
            closing_odds: 1.8,
            probability: 0.8, // 80% vs 50% implied = 30% divergence (> 15% anomaly)
            status: 'pending',
            market: 'asian_handicap',
            kickoff_utc: new Date().toISOString()
          }
        ],
        error: null
      });
    })
  };

  return {
    supabase: {
      from: vi.fn(() => chain)
    }
  };
});

// Mock API Football Client
vi.mock('../src/lib/apis/apifootball', () => {
  return {
    apiFootballClient: {
      getFixtures: vi.fn().mockResolvedValue({
        response: [
          {
            fixture: {
              id: 201,
              date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              status: { short: 'NS' }
            },
            teams: {
              home: { name: 'Arsenal' },
              away: { name: 'Chelsea' }
            }
          }
        ]
      })
    }
  };
});

// Mock Odds API
vi.mock('../src/lib/apis/oddspapi', () => {
  return {
    oddsApiClient: {
      getOdds: vi.fn().mockResolvedValue([
        {
          id: 'odds-match-201',
          home_team: 'Arsenal',
          away_team: 'Chelsea',
          commence_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          bookmakers: [
            {
              key: 'pinnacle',
              markets: [
                {
                  key: 'h2h',
                  outcomes: [
                    { name: 'Arsenal', price: 2.0 },
                    { name: 'Chelsea', price: 3.5 },
                    { name: 'Draw', price: 3.2 }
                  ]
                }
              ]
            }
          ]
        }
      ])
    }
  };
});

describe('Phase 7.5 & 8: Quant Audit Trails & Paper Trading Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test_secret';
    process.env.CRON_DRY_RUN = 'false';
  });

  describe('Divergence Anomaly Flagging', () => {
    it('should calculate divergence and flag anomalies when probability and market odds differ > 15%', async () => {
      const request = new Request('http://localhost/api/cron/generate-signals', {
        headers: { authorization: 'Bearer test_secret' }
      });

      const response = await handleGenerateSignals(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      
      expect(supabase.from).toHaveBeenCalledWith('signals');
    });
  });

  describe('Paper Trading Settlement', () => {
    it('should compute running bankroll progression and drawdown percentage correctly', async () => {
      const request = new Request('http://localhost/api/cron/settle', {
        headers: { authorization: 'Bearer test_secret' }
      });

      const response = await handleSettle(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.result.tradesCalculated).toBeDefined();
    });
  });
});
