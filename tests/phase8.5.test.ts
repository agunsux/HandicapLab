import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateKelly } from '../src/lib/engine/kelly';
import { sendTelegramAlert } from '../src/lib/services/telegram';
import { GET as handleHealthCheck } from '../src/app/api/health/route';
import { GET as handleGenerateSignals } from '../src/app/api/cron/generate-signals/route';
import { supabase } from '../src/lib/supabase.server';

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
        starting_bankroll: 1000.0,
        unit_size: 10.0,
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
        data: [
          {
            created_at: new Date().toISOString()
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
      getLeagues: vi.fn().mockResolvedValue({ response: [] }),
      getFixtures: vi.fn().mockResolvedValue({
        response: [
          {
            fixture: {
              id: 301,
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
      getSports: vi.fn().mockResolvedValue([]),
      getOdds: vi.fn().mockResolvedValue([
        {
          id: 'odds-match-301',
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

describe('Phase 8.5: System Hardening & Public Trust Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test_secret';
    process.env.CRON_DRY_RUN = 'false';
  });

  describe('Kelly Criterion Engine (kelly.ts)', () => {
    it('should calculate Kelly fraction properly', () => {
      // p = 0.55, odds = 2.0. Net net b = 1.0. q = 0.45.
      // f* = (1.0 * 0.55 - 0.45) / 1.0 = 0.10 (10%).
      // Quarter Kelly = 0.25 * 0.10 = 0.025. Capped at maxStakePct = 5.0% (0.05).
      const res = calculateKelly(2.0, 0.55, 5.0, 200);
      expect(res.stakeFraction).toBe(0.025);

      // Without cap being hit: p = 0.52, odds = 2.0. Net b = 1.0. q = 0.48.
      // f* = (0.52 - 0.48) = 0.04 (4%). Quarter Kelly = 0.25 * 0.04 = 0.01.
      const res2 = calculateKelly(2.0, 0.52, 5.0, 200);
      expect(res2.stakeFraction).toBe(0.01);
    });

    it('should return 0.0 for negative edge or invalid parameters', () => {
      expect(calculateKelly(2.0, 0.40, 5.0, 200).stakeFraction).toBe(0.0);
      expect(calculateKelly(1.0, 0.50, 5.0, 200).stakeFraction).toBe(0.0);
    });
  });

  describe('Telegram Alert Service (telegram.ts)', () => {
    it('should warn and return false if env credentials are missing', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;
      const res = await sendTelegramAlert('Test Alert');
      expect(res).toBe(false);
    });
  });

  describe('Health Check Route (/api/health)', () => {
    it('should execute DB check and API pings returning status 200', async () => {
      const response = await handleHealthCheck();
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('healthy');
      expect(json.checks.database).toBe('healthy');
    });
  });

  describe('Kelly Staking Integration in Ingestion Cron', () => {
    it('should successfully run pipeline querying config and calculating Kelly values', async () => {
      const request = new Request('http://localhost/api/cron/generate-signals', {
        headers: { authorization: 'Bearer test_secret' }
      });
      const response = await handleGenerateSignals(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });
  });
});
