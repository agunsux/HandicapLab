import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLeagueConfig } from '../src/lib/crons/leagueRegistry';
import { ApiFootballProvider } from '../src/lib/api/providers/apiFootball';
import { apiFootballClient } from '../src/lib/api/apiFootball';
import { GET as handleGenerateSignals } from '../src/app/api/cron/generate-signals/route';
import { GET as handleFeed } from '../src/app/api/signals/feed/route';
import { supabase } from '../src/lib/supabase.server';

// Mock apiFootballClient
vi.mock('../src/lib/api/apiFootball', () => {
  return {
    apiFootballClient: {
      getFixtures: vi.fn()
    }
  };
});

const futureKickoff = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

// Mock apifootball route client
vi.mock('../src/lib/apis/apifootball', () => {
  return {
    apiFootballClient: {
      getFixtures: vi.fn().mockImplementation(() => {
        return Promise.resolve({
          response: [
            {
              fixture: {
                id: 9991,
                date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                status: { short: 'NS' }
              },
              teams: {
                home: { name: 'USA' },
                away: { name: 'Mexico' }
              }
            }
          ]
        });
      })
    }
  };
});

// Mock Odds API
vi.mock('../src/lib/apis/oddspapi', () => {
  return {
    oddsApiClient: {
      getOdds: vi.fn().mockImplementation(() => {
        return Promise.resolve([
          {
            id: 'odds-match-9991',
            home_team: 'USA',
            away_team: 'Mexico',
            commence_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            bookmakers: [
              {
                key: 'pinnacle',
                markets: [
                  {
                    key: 'h2h',
                    outcomes: [
                      { name: 'USA', price: 1.85 },
                      { name: 'Mexico', price: 4.0 },
                      { name: 'Draw', price: 3.3 }
                    ]
                  }
                ]
              }
            ]
          }
        ]);
      })
    }
  };
});

// Mock Supabase
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
    insert: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        data: {
          id: 'match-wc-uuid',
          home_team: 'USA',
          away_team: 'Mexico',
          league: 'FIFA World Cup',
          kickoff: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'upcoming'
        },
        error: null
      });
    }),
    single: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        data: {
          id: 'signal-wc-123',
          home_team: 'USA',
          away_team: 'Mexico',
          league: 'FIFA World Cup',
          kickoff_utc: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        error: null
      });
    }),
    then: vi.fn().mockImplementation((resolve) => {
      resolve({
        data: [
          {
            id: 'signal-wc-123',
            home_team: 'USA',
            away_team: 'Mexico',
            league: 'FIFA World Cup',
            kickoff_utc: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            market: 'moneyline',
            selection: 'home',
            odds: 1.85,
            edge_pct: 7.2,
            confidence: 0.84,
            status: 'pending',
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

describe('Phase 32.8: World Cup Production Flow Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test_secret';
    process.env.CRON_DRY_RUN = 'false';
  });

  it('should have FIFA World Cup 2026 properly configured in registry', () => {
    const config = getLeagueConfig(1);
    expect(config).toBeDefined();
    expect(config?.id).toBe('world_cup_2026');
    expect(config?.enabled).toBe(true);
  });

  it('should run full prediction cron, generating a World Cup signal from fixtures & odds', async () => {
    const request = new Request('http://localhost/api/cron/generate-signals', {
      headers: { authorization: 'Bearer test_secret' }
    });

    const response = await handleGenerateSignals(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it('should list the generated World Cup signal inside the feed endpoint with dynamic fields', async () => {
    const request = new Request('http://localhost/api/signals/feed?market=ML', {
      headers: { 'x-user-id': 'test-user-id' }
    });

    const response = await handleFeed(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.feed).toBeDefined();
    expect(json.feed.length).toBeGreaterThan(0);

    const wcSignal = json.feed.find((item: any) => item.league === 'FIFA World Cup');
    expect(wcSignal).toBeDefined();
    expect(wcSignal.status).toBe('ACTIVE');
    expect(wcSignal.odds_age_minutes).toBeDefined();
    expect(wcSignal.priority_score).toBeGreaterThan(0);
  });
});
