import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateKelly } from '../src/lib/engine/kelly';
import { CalibrationEngine } from '../src/lib/engine/calibration';
import { supabase } from '../src/lib/supabase.server';
import { GET as handleGenerateSignals } from '../src/app/api/cron/generate-signals/route';
import { GET as handleTestFeed } from '../src/app/api/admin/test-competition-feed/route';

// Mock Supabase
vi.mock('../src/lib/supabase.server', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        starting_bankroll: 10000.0,
        unit_size: 100.0,
        max_stake_percentage: 5.0
      },
      error: null
    }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockImplementation((payload) => {
      return {
        select: vi.fn().mockImplementation(() => {
          return {
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'sig-inserted-456',
                ...payload
              },
              error: null
            })
          };
        })
      };
    }),
    then: vi.fn().mockImplementation((resolve) => {
      resolve({
        data: [],
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

// Mock apiFootballClient
vi.mock('../src/lib/apis/apifootball', () => {
  return {
    apiFootballClient: {
      getFixtures: vi.fn().mockResolvedValue({
        response: [
          {
            fixture: {
              id: 501,
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

// Mock Odds API client
vi.mock('../src/lib/apis/oddspapi', () => {
  return {
    oddsApiClient: {
      getOdds: vi.fn().mockResolvedValue([
        {
          id: 'odds-match-501',
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

describe('Phase 8.6: Statistical Confidence Layer & Calibration Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test_secret';
    process.env.CRON_DRY_RUN = 'false';
    process.env.ADMIN_SECRET = 'test_admin_secret';
  });

  describe('Kelly Criterion Maturity Gates', () => {
    it('should use Flat 1% in validation mode (<100 signals)', () => {
      // 50 settled signals (Validation mode)
      const res = calculateKelly(2.0, 0.60, 5.0, 50);
      expect(res.mode).toBe('validation');
      expect(res.stakeFraction).toBe(0.01);
    });

    it('should use 10% Kelly in early mode (100-199 signals)', () => {
      // p = 0.60, odds = 2.0. Net b = 1.0. q = 0.40.
      // Full Kelly f* = (1.0 * 0.60 - 0.40) / 1.0 = 0.20 (20%).
      // 10% Kelly = 0.10 * 0.20 = 0.02 (2%).
      const res = calculateKelly(2.0, 0.60, 5.0, 150);
      expect(res.mode).toBe('early');
      expect(res.stakeFraction).toBe(0.02);
    });

    it('should use 25% Kelly in mature mode (200+ signals)', () => {
      // p = 0.60, odds = 2.0. Net b = 1.0. q = 0.40.
      // Full Kelly f* = (1.0 * 0.60 - 0.40) / 1.0 = 0.20 (20%).
      // 25% Kelly = 0.25 * 0.20 = 0.05 (5%).
      const res = calculateKelly(2.0, 0.60, 10.0, 250);
      expect(res.mode).toBe('mature');
      expect(res.stakeFraction).toBe(0.05);
    });

    it('should cap the fraction at max_stake_percentage', () => {
      // p = 0.70, odds = 2.0. Net b = 1.0. q = 0.30.
      // Full Kelly f* = 0.40. Mature Kelly = 0.25 * 0.40 = 0.10.
      // Capped at maxStakePct = 5.0 (0.05).
      const res = calculateKelly(2.0, 0.70, 5.0, 300);
      expect(res.stakeFraction).toBe(0.05);
    });
  });

  describe('Two-Tier Calibration Engine', () => {
    it('should return base thresholds when there are not enough settled signals', async () => {
      vi.mocked(supabase.from).mockImplementationOnce((table: string) => {
        return {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation((limitVal) => {
            return {
              then: vi.fn().mockImplementation((resolve) => {
                resolve({
                  data: [], // 0 signals
                  error: null
                });
              })
            } as any;
          })
        } as any;
      });

      const thresholds = await CalibrationEngine.getDynamicThresholds();
      expect(thresholds.AH).toBe(3.0);
      expect(thresholds.OU).toBe(4.0);
      expect(thresholds.ML).toBe(5.0);
    });

    it('should tighten further (+1.0%) if Brier Score > 0.30', async () => {
      vi.mocked(supabase.from).mockImplementationOnce((table: string) => {
        return {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation((limitVal) => {
            return {
              then: vi.fn().mockImplementation((resolve) => {
                resolve({
                  data: Array.from({ length: 20 }, (_, i) => ({
                    probability: 0.95, // predicted 95%
                    status: 'lost', // but lost (brier diff = 0.95^2 = 0.9025 > 0.30)
                    market: 'asian_handicap',
                    settled_at: new Date().toISOString()
                  })),
                  error: null
                });
              })
            } as any;
          })
        } as any;
      });

      const thresholds = await CalibrationEngine.getDynamicThresholds();
      expect(thresholds.brierScore).toBeGreaterThan(0.30);
      expect(thresholds.AH).toBe(4.0); // Tightened by +1.0% (3.0 -> 4.0)
      expect(thresholds.OU).toBe(5.0); // Tightened by +1.0% (4.0 -> 5.0)
      expect(thresholds.ML).toBe(6.0); // Tightened by +1.0% (5.0 -> 6.0)
    });
  });

  describe('/api/admin/test-competition-feed endpoint', () => {
    it('should reject unauthorized calls with 401', async () => {
      const request = new Request('http://localhost/api/admin/test-competition-feed?league=world_cup_2026', {
        headers: { 'x-admin-secret': 'wrong' }
      });
      const response = await handleTestFeed(request);
      expect(response.status).toBe(401);
    });

    it('should return 200 with test feed data when authorized', async () => {
      const request = new Request('http://localhost/api/admin/test-competition-feed?league=world_cup_2026', {
        headers: { 'x-admin-secret': 'test_admin_secret' }
      });
      const response = await handleTestFeed(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.audit).toBeDefined();
      // Ensure provider details are removed/sanitized
      const audit = json.audit[0];
      expect(audit.providerLeagueId).toBeUndefined();
      expect(audit.sportKey).toBeUndefined();
    });
  });
});
