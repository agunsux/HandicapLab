import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as handleGenerateSignals } from '../src/app/api/cron/generate-signals/route';
import { GET as handleCaptureClosing } from '../src/app/api/cron/capture-closing/route';
import { GET as handleSettle } from '../src/app/api/cron/settle/route';
import { GET as handlePerformance } from '../src/app/api/stats/performance/route';
import { supabase } from '../src/lib/supabase.server';
import { apiFootballClient } from '../src/lib/apis/apifootball';

// Mock Supabase
vi.mock('../src/lib/supabase.server', () => {
  const mockFrom = vi.fn((table: string) => {
    const chain: any = {
      select: vi.fn().mockImplementation(() => chain),
      eq: vi.fn().mockImplementation(() => chain),
      gte: vi.fn().mockImplementation(() => chain),
      lte: vi.fn().mockImplementation(() => chain),
      not: vi.fn().mockImplementation(() => chain),
      order: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockImplementation(() => chain),
      in: vi.fn().mockImplementation(() => chain),
      lt: vi.fn().mockImplementation(() => chain),
      is: vi.fn().mockImplementation(() => chain),
      or: vi.fn().mockImplementation(() => chain),
      insert: vi.fn().mockImplementation(() => chain),
      update: vi.fn().mockImplementation(() => chain),
      upsert: vi.fn().mockImplementation(() => chain),
      maybeSingle: vi.fn().mockImplementation(() => {
        if (table === 'matches') {
          return Promise.resolve({
            data: {
              id: 'match-1',
              status: 'finished',
              home_goals: 2,
              away_goals: 1
            },
            error: null
          });
        }
        return Promise.resolve({ data: { id: 'sig-1' }, error: null });
      }),
      single: vi.fn().mockImplementation(() => {
        if (table === 'matches') {
          return Promise.resolve({
            data: {
              id: 'match-1',
              status: 'finished',
              home_goals: 2,
              away_goals: 1
            },
            error: null
          });
        }
        return Promise.resolve({ data: { id: 'sig-1' }, error: null });
      }),
      then: vi.fn().mockImplementation((resolve) => {
        if (table === 'signals') {
          resolve({
            data: [
              {
                id: 'sig-1',
                match_id: 'match-1',
                league: 'Premier League',
                home_team: 'Arsenal',
                away_team: 'Chelsea',
                kickoff_utc: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                market: 'moneyline',
                selection: 'home',
                odds: 2.0,
                opening_odds: 2.0,
                opening_probability: 0.5,
                closing_odds: 1.8,
                status: 'pending'
              }
            ],
            error: null
          });
        } else if (table === 'matches') {
          resolve({
            data: [
              {
                id: 'match-1',
                status: 'finished',
                home_goals: 2,
                away_goals: 1
              }
            ],
            error: null
          });
        } else {
          resolve({ data: [], error: null });
        }
      })
    };
    return chain;
  });

  return {
    supabase: {
      from: mockFrom
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
              id: 101,
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
          id: 'odds-match-1',
          home_team: 'Arsenal',
          away_team: 'Chelsea',
          commence_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          bookmakers: [
            {
              key: 'pinnacle',
              markets: [
                {
                  key: 'h2h',
                  outcomes: [
                    { name: 'Arsenal', price: 1.8 },
                    { name: 'Chelsea', price: 4.2 },
                    { name: 'Draw', price: 3.5 }
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

describe('Phase 6: Live Paper Trading & CLV Engine Activation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CRON_SECRET: 'test_cron_secret',
      CRON_DRY_RUN: 'false'
    };
  });

  describe('Authorization check', () => {
    it('should return 401 if CRON_SECRET authorization header is missing or incorrect', async () => {
      const request = new Request('http://localhost/api/cron/generate-signals', {
        headers: { authorization: 'Bearer wrong' }
      });
      const response = await handleGenerateSignals(request);
      expect(response.status).toBe(401);
    });

    it('should proceed if CRON_SECRET is correct', async () => {
      process.env.CRON_DRY_RUN = 'true';
      const request = new Request('http://localhost/api/cron/generate-signals', {
        headers: { authorization: 'Bearer test_cron_secret' }
      });
      const response = await handleGenerateSignals(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });
  });

  describe('Capture Closing Odds Cron', () => {
    it('should process pending signals close to kickoff and update closing odds', async () => {
      const request = new Request('http://localhost/api/cron/capture-closing', {
        headers: { authorization: 'Bearer test_cron_secret' }
      });

      const response = await handleCaptureClosing(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.capturedCount).toBe(1);
    });
  });

  describe('Settlement and CLV calculation', () => {
    it('should transition status to settling, compute clv_percentage, and settle signals', async () => {
      vi.mocked(apiFootballClient.getFixtures).mockResolvedValue({
        response: [
          {
            fixture: {
              id: 101,
              date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              status: { short: 'FT', elapsed: 90 }
            },
            goals: { home: 2, away: 1 },
            score: {
              halftime: { home: 1, away: 0 },
              fulltime: { home: 2, away: 1 }
            },
            teams: {
              home: { name: 'Arsenal' },
              away: { name: 'Chelsea' }
            }
          }
        ]
      });

      const request = new Request('http://localhost/api/cron/settle', {
        headers: { authorization: 'Bearer test_cron_secret' }
      });

      const response = await handleSettle(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.result.signalsSettled).toBe(1);
    });
  });

  describe('Performance stats API', () => {
    it('should aggregate clv_percentage and return averageClv', async () => {
      // Mock supabase to return signals with clv_percentage
      vi.mocked(supabase.from).mockImplementationOnce((table: string) => {
        return {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockImplementation((col, opts) => {
            return {
              then: vi.fn().mockImplementation((resolve) => {
                resolve({
                  data: Array.from({ length: 50 }, (_, i) => ({
                    id: String(i + 1),
                    status: i % 2 === 0 ? 'won' : 'lost',
                    odds: i % 2 === 0 ? 2.0 : 1.9,
                    probability: 0.5,
                    market: i % 2 === 0 ? 'asian_handicap' : 'over_under',
                    clv_percentage: i % 2 === 0 ? 5.5 : -2.5,
                    settled_at: new Date().toISOString()
                  })),
                  error: null
                });
              })
            } as any;
          })
        } as any;
      });

      const response = await handlePerformance();
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.averageClv).toBe(1.5); // (5.5 + -2.5) / 2 = 1.5
    });
  });
});
