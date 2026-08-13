// Native OddsPAPI v4 Adapter — Deterministic Tests
// Location: tests/oddsapi-native.test.ts
// Validates schema parsing, normalization of the four project markets,
// line derivation from bookmakerOutcomeId, unknown-market resilience,
// and the provider status taxonomy. No network: a fake client is injected.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: {
      rpc: vi.fn().mockResolvedValue({
        data: { ok: true, reservation_id: 'res-test', safe_limit: 250, consumed: 0, reserved: 1, safe_remaining: 249 },
        error: null,
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  };
});

import { OddsPapiV4Provider } from '../src/lib/data/providers/odds/native/provider';
import { OddsPapiDiscovery } from '../src/lib/data/providers/odds/native/discovery';
import { normalizeNativeFixture, normalizeNativeOddsResponse } from '../src/lib/data/providers/odds/native/normalize';
import { NativeOddsResponseSchema, NativeMarketsResponseSchema, NativeSportsResponseSchema, NativeBookmakersResponseSchema } from '../src/lib/data/providers/odds/native/schemas';
import { OddsPapiError } from '../src/lib/data/providers/odds/native/client';
import type { NativeOddsClient } from '../src/lib/data/providers/odds/native/client';
import type { NativeOddsFixture, NativeMarket } from '../src/lib/data/providers/odds/native/schemas';

// ─── Fixture helpers (shapes verified against oddspapi.io/docs) ──────

function makeFixture(overrides: Partial<NativeOddsFixture> = {}): NativeOddsFixture {
  return {
    fixtureId: 'id1000001761301153',
    participant1Id: 1302,
    participant2Id: 4872,
    participant1Name: 'Liverpool FC',
    participant2Name: 'Manchester United',
    sportId: 10,
    tournamentId: 17,
    seasonId: 130951,
    statusId: 0,
    hasOdds: true,
    startTime: '2026-04-13T19:00:00.000Z',
    updatedAt: '2026-04-08T18:00:30.461Z',
    tournamentName: 'Premier League',
    bookmakerOdds: {
      pinnacle: {
        bookmakerIsActive: true,
        bookmakerFixtureId: '1626291706',
        fixturePath: 'https://www.pinnacle.com/en/e/e/e/1626291706/#all',
        suspended: false,
        markets: {
          '101': {
            bookmakerMarketId: 'line/29/1980/1626291706/56152425451/0/moneyline',
            marketActive: true,
            outcomes: {
              '101': {
                players: {
                  '0': { active: true, price: 2.1, bookmakerOutcomeId: 'home' },
                },
              },
              '102': {
                players: {
                  '0': { active: true, price: 3.4, bookmakerOutcomeId: 'draw' },
                },
              },
              '103': {
                players: {
                  '0': { active: true, price: 3.2, bookmakerOutcomeId: 'away' },
                },
              },
            },
          },
          '106': {
            bookmakerMarketId: 'line/29/1980/1626291706/56152425451/0/totals',
            marketActive: true,
            outcomes: {
              '106': {
                players: {
                  '0': { active: true, price: 1.95, bookmakerOutcomeId: '2.5/over' },
                },
              },
              '107': {
                players: {
                  '0': { active: true, price: 1.85, bookmakerOutcomeId: '2.5/under' },
                },
              },
            },
          },
        },
      },
    },
    ...overrides,
  } as NativeOddsFixture;
}

function makeMarket(overrides: Partial<NativeMarket> = {}): NativeMarket {
  return {
    marketId: 101,
    marketLength: 3,
    marketName: 'Full Time Result',
    playerProp: false,
    sportId: 10,
    handicap: 0,
    period: 'fulltime',
    marketType: '1x2',
    outcomes: [
      { outcomeId: 101, outcomeName: '1' },
      { outcomeId: 102, outcomeName: 'X' },
      { outcomeId: 103, outcomeName: '2' },
    ],
    ...overrides,
  };
}

const MARKETS: NativeMarket[] = [
  makeMarket(),
  makeMarket({
    marketId: 104,
    marketLength: 2,
    marketName: 'Both Teams To Score',
    marketType: 'totals',
    outcomes: [
      { outcomeId: 104, outcomeName: 'Yes' },
      { outcomeId: 105, outcomeName: 'No' },
    ],
  }),
  makeMarket({
    marketId: 106,
    marketLength: 2,
    marketName: 'Over Under Full Time',
    marketType: 'totals',
    handicap: 2.5,
    outcomes: [
      { outcomeId: 106, outcomeName: 'Over' },
      { outcomeId: 107, outcomeName: 'Under' },
    ],
  }),
  makeMarket({
    marketId: 200,
    marketLength: 2,
    marketName: 'Asian Handicap Full Time',
    marketType: 'asian_handicap',
    handicap: 0.5,
    outcomes: [
      { outcomeId: 200, outcomeName: 'Home' },
      { outcomeId: 201, outcomeName: 'Away' },
    ],
  }),
];

function makeContext(verified = ['pinnacle']) {
  return {
    verifiedBookmakerSlugs: new Set(verified),
    marketsById: new Map(MARKETS.map((m) => [m.marketId, m])),
  };
}

// ─── Fake client ─────────────────────────────────────────────────────

function makeFakeClient(overrides: Partial<NativeOddsClient> = {}): NativeOddsClient {
  const base: any = {
    get: vi.fn().mockResolvedValue({ data: [], status: 200, fromCache: false }),
    getAccountInfo: vi.fn().mockResolvedValue({ requestLimit: 250, requestCount: 5 }),
  };
  return { ...base, ...overrides } as NativeOddsClient;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('Native OddsPAPI schemas', () => {
  it('parses a valid odds-by-tournaments response (array)', () => {
    const fixture = makeFixture();
    const parsed = NativeOddsResponseSchema.safeParse([fixture]);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const fixtures = parsed.data as NativeOddsFixture[];
      expect(fixtures[0].fixtureId).toBe('id1000001761301153');
      expect(fixtures[0].bookmakerOdds?.pinnacle?.markets?.['101']?.outcomes?.['101']?.players?.['0']?.price).toBe(2.1);
    }
  });

  it('parses a single-object odds response', () => {
    const parsed = NativeOddsResponseSchema.safeParse(makeFixture());
    expect(parsed.success).toBe(true);
  });

  it('parses the markets catalog', () => {
    const parsed = NativeMarketsResponseSchema.safeParse(MARKETS);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toHaveLength(4);
      expect(parsed.data.find((m) => m.marketId === 106)?.marketType).toBe('totals');
    }
  });

  it('rejects a malformed fixture (missing fixtureId)', () => {
    const { fixtureId: _omit, ...rest } = makeFixture() as any;
    const parsed = NativeOddsResponseSchema.safeParse([rest]);
    expect(parsed.success).toBe(false);
  });

  it('accepts markets with period: null (live API behavior)', () => {
    const parsed = NativeMarketsResponseSchema.safeParse([
      makeMarket({ marketId: 999, period: null as any, marketType: 'totals' }),
    ]);
    expect(parsed.success).toBe(true);
  });

  it('parses the markets catalog including null periods', () => {
    const withNullPeriod = MARKETS.map((m, i) => (i === 1 ? { ...m, period: null as any } : m));
    const parsed = NativeMarketsResponseSchema.safeParse(withNullPeriod);
    expect(parsed.success).toBe(true);
  });
});

describe('Native normalization — markets', () => {
  it('normalizes moneyline (1X2) with home/draw/away prices', () => {
    const { snapshots } = normalizeNativeFixture(makeFixture(), makeContext());
    const ml = snapshots.find((s) => s.marketType === 'moneyline');
    expect(ml).toBeDefined();
    expect(ml!.priceHome).toBe(2.1);
    expect(ml!.priceDraw).toBe(3.4);
    expect(ml!.priceAway).toBe(3.2);
    expect(ml!.line).toBe(0);
    expect(ml!.bookmaker).toBe('pinnacle');
    expect(ml!.fixtureId).toBe('id1000001761301153');
  });

  it('normalizes over/under with line derived from bookmakerOutcomeId', () => {
    const { snapshots } = normalizeNativeFixture(makeFixture(), makeContext());
    const ou = snapshots.find((s) => s.marketType === 'over_under');
    expect(ou).toBeDefined();
    expect(ou!.line).toBe(2.5);
    expect(ou!.priceHome).toBe(1.95); // over
    expect(ou!.priceAway).toBe(1.85); // under
  });

  it('normalizes Asian Handicap when the market is discovered', () => {
    const fixture = makeFixture({
      bookmakerOdds: {
        pinnacle: {
          bookmakerIsActive: true,
          suspended: false,
          markets: {
            '200': {
              bookmakerMarketId: 'line/29/1980/1626291706/0/spread',
              marketActive: true,
              outcomes: {
                '200': {
                  players: { '0': { active: true, price: 1.9, bookmakerOutcomeId: '-0.5/home' } },
                },
                '201': {
                  players: { '0': { active: true, price: 1.9, bookmakerOutcomeId: '-0.5/away' } },
                },
              },
            },
          },
        },
      },
    });
    const { snapshots } = normalizeNativeFixture(fixture, makeContext());
    const ah = snapshots.find((s) => s.marketType === 'asian_handicap');
    expect(ah).toBeDefined();
    expect(ah!.line).toBe(-0.5);
    expect(ah!.priceHome).toBe(1.9);
    expect(ah!.priceAway).toBe(1.9);
  });

  it('normalizes BTTS when the market is discovered', () => {
    const fixture = makeFixture({
      bookmakerOdds: {
        pinnacle: {
          bookmakerIsActive: true,
          suspended: false,
          markets: {
            '104': {
              bookmakerMarketId: 'line/29/1980/1626291706/0/btts',
              marketActive: true,
              outcomes: {
                '104': {
                  players: { '0': { active: true, price: 1.7, bookmakerOutcomeId: 'yes' } },
                },
                '105': {
                  players: { '0': { active: true, price: 2.1, bookmakerOutcomeId: 'no' } },
                },
              },
            },
          },
        },
      },
    });
    const { snapshots } = normalizeNativeFixture(fixture, makeContext());
    const btts = snapshots.find((s) => s.marketType === 'btts');
    expect(btts).toBeDefined();
    expect(btts!.priceHome).toBe(1.7);
    expect(btts!.priceAway).toBe(2.1);
  });

  it('handles multiple handicap/total lines (multiple markets)', () => {
    const fixture = makeFixture({
      bookmakerOdds: {
        pinnacle: {
          bookmakerIsActive: true,
          suspended: false,
          markets: {
            '106': {
              marketActive: true,
              outcomes: {
                '106': { players: { '0': { active: true, price: 1.95, bookmakerOutcomeId: '2.5/over' } } },
                '107': { players: { '0': { active: true, price: 1.85, bookmakerOutcomeId: '2.5/under' } } },
              },
            },
            '107': {
              marketActive: true,
              outcomes: {
                '108': { players: { '0': { active: true, price: 2.2, bookmakerOutcomeId: '3.5/over' } } },
                '109': { players: { '0': { active: true, price: 1.65, bookmakerOutcomeId: '3.5/under' } } },
              },
            },
          },
        },
      },
    });
    const markets = [...MARKETS, makeMarket({ marketId: 107, marketName: 'Over Under Full Time', marketType: 'totals', handicap: 3.5 })];
    const ctx = { verifiedBookmakerSlugs: new Set(['pinnacle']), marketsById: new Map(markets.map((m) => [m.marketId, m])) };
    const { snapshots } = normalizeNativeFixture(fixture, ctx);
    const ouLines = snapshots.filter((s) => s.marketType === 'over_under').map((s) => s.line).sort();
    expect(ouLines).toEqual([2.5, 3.5]);
  });

  it('skips unknown market IDs without crashing', () => {
    const fixture = makeFixture({
      bookmakerOdds: {
        pinnacle: {
          bookmakerIsActive: true,
          suspended: false,
          markets: {
            '9999': {
              marketActive: true,
              outcomes: {
                '1': { players: { '0': { active: true, price: 2.0, bookmakerOutcomeId: 'home' } } },
              },
            },
            '101': {
              marketActive: true,
              outcomes: {
                '101': { players: { '0': { active: true, price: 2.1, bookmakerOutcomeId: 'home' } } },
                '102': { players: { '0': { active: true, price: 3.4, bookmakerOutcomeId: 'draw' } } },
                '103': { players: { '0': { active: true, price: 3.2, bookmakerOutcomeId: 'away' } } },
              },
            },
          },
        },
      },
    });
    const { snapshots, stats } = normalizeNativeFixture(fixture, makeContext());
    expect(stats.skippedUnknownMarkets).toBe(1);
    expect(snapshots.some((s) => s.marketType === 'moneyline')).toBe(true);
  });

  it('skips unverified bookmakers', () => {
    const { snapshots, stats } = normalizeNativeFixture(makeFixture(), makeContext(['pinnacle']));
    expect(stats.skippedUnverifiedBookmakers).toBe(0);
    expect(snapshots.every((s) => s.bookmaker === 'pinnacle')).toBe(true);

    const unverifiedFixture = makeFixture({
      bookmakerOdds: {
        pinnacle: makeFixture().bookmakerOdds!.pinnacle!,
        randombook: {
          bookmakerIsActive: true,
          suspended: false,
          markets: {
            '101': {
              marketActive: true,
              outcomes: {
                '101': { players: { '0': { active: true, price: 2.0, bookmakerOutcomeId: 'home' } } },
              },
            },
          },
        },
      },
    });
    const res = normalizeNativeFixture(unverifiedFixture, makeContext(['pinnacle']));
    expect(res.stats.skippedUnverifiedBookmakers).toBe(1);
    expect(res.snapshots.every((s) => s.bookmaker === 'pinnacle')).toBe(true);
  });

  it('skips outcomes with no price', () => {
    const fixture = makeFixture({
      bookmakerOdds: {
        pinnacle: {
          bookmakerIsActive: true,
          suspended: false,
          markets: {
            '101': {
              marketActive: true,
              outcomes: {
                '101': { players: { '0': { active: false, price: 0, bookmakerOutcomeId: 'home' } } },
                '102': { players: { '0': { active: true, price: 3.4, bookmakerOutcomeId: 'draw' } } },
                '103': { players: { '0': { active: true, price: 3.2, bookmakerOutcomeId: 'away' } } },
              },
            },
          },
        },
      },
    });
    const { snapshots, stats } = normalizeNativeFixture(fixture, makeContext());
    expect(stats.skippedNoPrice).toBeGreaterThan(0);
    // moneyline still normalized from the priced outcomes
    expect(snapshots.some((s) => s.marketType === 'moneyline')).toBe(true);
  });

  it('produces no snapshots for an empty odds response', () => {
    const { snapshots, stats } = normalizeNativeFixture(
      { ...makeFixture(), bookmakerOdds: {} },
      makeContext()
    );
    expect(snapshots).toEqual([]);
    expect(stats.snapshots).toBe(0);
  });
});

describe('Native normalization — response-level', () => {
  it('maps to the sharpOdds shape with real fixture ids and prices', () => {
    const { sharp } = normalizeNativeOddsResponse([makeFixture()], makeContext());
    expect(sharp).toHaveLength(1);
    const s = sharp[0];
    expect(s.fixtureId).toBe('id1000001761301153');
    expect(s.homeTeam).toBe('Liverpool FC');
    expect(s.awayTeam).toBe('Manchester United');
    expect(s.commenceTime).toBe('2026-04-13T19:00:00.000Z');
    const bk = s.bookmakers[0];
    expect(bk.key).toBe('pinnacle');
    const markets = bk.markets.map((m) => m.key).sort();
    expect(markets).toContain('h2h');
    expect(markets).toContain('totals');
    const ml = bk.markets.find((m) => m.key === 'h2h');
    expect(ml!.outcomes[0].price).toBe(2.1);
  });

  it('handles multiple bookmakers in one response', () => {
    const fixture = makeFixture({
      bookmakerOdds: {
        pinnacle: makeFixture().bookmakerOdds!.pinnacle!,
        sbobet: {
          bookmakerIsActive: true,
          suspended: false,
          markets: {
            '101': {
              marketActive: true,
              outcomes: {
                '101': { players: { '0': { active: true, price: 2.05, bookmakerOutcomeId: 'home' } } },
                '102': { players: { '0': { active: true, price: 3.5, bookmakerOutcomeId: 'draw' } } },
                '103': { players: { '0': { active: true, price: 3.1, bookmakerOutcomeId: 'away' } } },
              },
            },
          },
        },
      },
    });
    const ctx = makeContext(['pinnacle', 'sbobet']);
    const { snapshots } = normalizeNativeOddsResponse([fixture], ctx);
    const books = new Set(snapshots.map((s) => s.bookmaker));
    expect(books).toEqual(new Set(['pinnacle', 'sbobet']));
  });
});

describe('Provider status taxonomy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeProvider(client: NativeOddsClient, markets: NativeMarket[] = MARKETS, tournaments = [{ tournamentId: 17, tournamentSlug: 'premier-league', tournamentName: 'Premier League', categoryName: 'England', futureFixtures: 10, upcomingFixtures: 2, liveFixtures: 0 }]) {
    const discovery = new OddsPapiDiscovery(client);
    vi.spyOn(discovery, 'getSoccerMarkets').mockResolvedValue(markets.map((m) => ({ marketId: m.marketId, marketName: m.marketName, marketType: m.marketType, handicap: m.handicap, outcomes: m.outcomes })));
    vi.spyOn(discovery, 'getSoccerTournaments').mockResolvedValue(tournaments);
    vi.spyOn(discovery, 'getVerifiedSharpBookmakers').mockResolvedValue({
      verified: [{ slug: 'pinnacle', name: 'Pinnacle' }],
      unavailable: ['Circa', 'SBO'],
    });
    vi.spyOn(discovery, 'getSoccerSportId').mockResolvedValue(10);
    return new OddsPapiV4Provider(client, discovery);
  }

  it('reports HEALTHY only when real odds normalized (HTTP 200 + fixtures)', async () => {
    const client = makeFakeClient({
      get: vi.fn().mockResolvedValue({
        data: [makeFixture()],
        status: 200,
        fromCache: false,
      }),
    });
    const provider = makeProvider(client);
    const status = await provider.getProviderStatus();
    expect(status.status).toBe('HEALTHY');
    expect(status.fixtureCount).toBe(1);
    expect(status.snapshotCount).toBeGreaterThan(0);
    expect(status.verifiedBookmakers).toEqual(['pinnacle']);
  });

  it('reports NO_ODDS for a valid response with no eligible odds', async () => {
    const client = makeFakeClient({
      get: vi.fn().mockResolvedValue({ data: [], status: 200, fromCache: false }),
    });
    const provider = makeProvider(client);
    const status = await provider.getProviderStatus();
    expect(status.status).toBe('NO_ODDS');
    expect(status.snapshotCount).toBe(0);
  });

  it('reports INVALID_KEY on HTTP 401', async () => {
    const client = makeFakeClient({
      get: vi.fn().mockRejectedValue(
        new OddsPapiError('INVALID_KEY', 'odds-by-tournaments', 'OddsPAPI rejected the API key (401)', 401, 'INVALID_KEY')
      ),
    });
    const provider = makeProvider(client);
    const status = await provider.getProviderStatus();
    expect(status.status).toBe('INVALID_KEY');
    expect(status.httpStatus).toBe(401);
  });

  it('reports RATE_LIMITED on HTTP 429', async () => {
    const client = makeFakeClient({
      get: vi.fn().mockRejectedValue(
        new OddsPapiError('RATE_LIMITED', 'odds-by-tournaments', 'OddsPAPI rate limited (429)', 429, 'RATE_LIMITED')
      ),
    });
    const provider = makeProvider(client);
    const status = await provider.getProviderStatus();
    expect(status.status).toBe('RATE_LIMITED');
    expect(status.httpStatus).toBe(429);
  });

  it('reports DEGRADED on HTTP 404 (contract error)', async () => {
    const client = makeFakeClient({
      get: vi.fn().mockRejectedValue(
        new OddsPapiError('CONTRACT_ERROR', 'odds-by-tournaments', 'OddsPAPI HTTP 404: Not Found', 404, 'HTTP_404')
      ),
    });
    const provider = makeProvider(client);
    const status = await provider.getProviderStatus();
    expect(status.status).toBe('DEGRADED');
    expect(status.httpStatus).toBe(404);
    expect(status.errorCode).toBe('HTTP_404');
  });

  it('reports PARSING_ERROR on schema failure', async () => {
    const client = makeFakeClient({
      get: vi.fn().mockRejectedValue(
        new OddsPapiError('PARSING_ERROR', 'odds-by-tournaments', 'schema failed', 200, 'VALIDATION_FAILED')
      ),
    });
    const provider = makeProvider(client);
    const status = await provider.getProviderStatus();
    expect(status.status).toBe('PARSING_ERROR');
  });

  it('reports QUOTA when the local quota manager blocks', async () => {
    const client = makeFakeClient({
      get: vi.fn().mockRejectedValue(
        new OddsPapiError('QUOTA', 'odds-by-tournaments', 'Quota blocked: QUOTA_EXHAUSTED')
      ),
    });
    const provider = makeProvider(client);
    const status = await provider.getProviderStatus();
    expect(status.status).toBe('QUOTA');
  });

  it('healthCheck is false unless HEALTHY', async () => {
    const healthyClient = makeFakeClient({
      get: vi.fn().mockResolvedValue({ data: [makeFixture()], status: 200, fromCache: false }),
    });
    const healthyProvider = makeProvider(healthyClient);
    expect(await healthyProvider.healthCheck()).toBe(true);

    const degradedClient = makeFakeClient({
      get: vi.fn().mockRejectedValue(new OddsPapiError('CONTRACT_ERROR', 'odds', '404', 404)),
    });
    const degradedProvider = makeProvider(degradedClient);
    expect(await degradedProvider.healthCheck()).toBe(false);
  });

  it('no mock fallback: empty data stays empty, errors propagate as statuses', async () => {
    const client = makeFakeClient({
      get: vi.fn().mockResolvedValue({ data: [], status: 200, fromCache: false }),
    });
    const provider = makeProvider(client);
    const status = await provider.getProviderStatus();
    expect(status.status).toBe('NO_ODDS');
    expect(status.fixtureCount).toBe(0);
    expect(status.snapshotCount).toBe(0);
  });
});

describe('Native client error classification', () => {
  it('classifies HTTP 401/404/429 from raw fetch failures', () => {
    const makeErr = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status, code: `HTTP_${status}` });
    expect(new OddsPapiError('INVALID_KEY', 'odds', 'x', 401).kind).toBe('INVALID_KEY');
    expect(new OddsPapiError('RATE_LIMITED', 'odds', 'x', 429).kind).toBe('RATE_LIMITED');
    expect(new OddsPapiError('CONTRACT_ERROR', 'odds', 'x', 404).kind).toBe('CONTRACT_ERROR');
    expect(makeErr(401).status).toBe(401);
  });
});

describe('Native discovery — bookmaker resolution', () => {
  beforeEach(() => {
    new OddsPapiDiscovery({} as any).clearCache();
  });

  it('resolves approved names with provider-side naming variants', async () => {
    const getSpy = vi.fn().mockResolvedValue({
      data: [
        { bookmakerName: 'Pinnacle Sports', slug: 'pinnacle', liveOdds: false, cloneOf: null },
        { bookmakerName: 'SBOBET', slug: 'sbobet', liveOdds: false, cloneOf: null },
        { bookmakerName: '188BET', slug: '188bet', liveOdds: false, cloneOf: null },
      ],
      status: 200,
      fromCache: false,
    });
    const fakeClient: any = { get: getSpy };
    const discovery = new OddsPapiDiscovery(fakeClient);
    const result = await discovery.getVerifiedSharpBookmakers();
    expect(result.verified.map((b) => b.slug).sort()).toEqual(['pinnacle', 'sbobet']);
    expect(result.unavailable).toEqual(['Circa']);
  });

  it('marks approved bookmakers unavailable when absent from the response', async () => {
    const getSpy = vi.fn().mockResolvedValue({
      data: [{ bookmakerName: 'Bet365', slug: 'bet365', liveOdds: false, cloneOf: null }],
      status: 200,
      fromCache: false,
    });
    const fakeClient: any = { get: getSpy };
    const discovery = new OddsPapiDiscovery(fakeClient);
    const result = await discovery.getVerifiedSharpBookmakers();
    expect(result.verified).toEqual([]);
    expect(result.unavailable).toEqual(['Pinnacle', 'Circa', 'SBO']);
  });

  it('parses the live bookmakers catalog schema', () => {
    const parsed = NativeBookmakersResponseSchema.safeParse([
      { bookmakerName: 'Pinnacle', slug: 'pinnacle', liveOdds: false, cloneOf: null },
    ]);
    expect(parsed.success).toBe(true);
  });

  it('deduplicates concurrent discovery loads (single-flight)', async () => {
    new OddsPapiDiscovery({} as any).clearCache();
    let calls = 0;
    const getSpy = vi.fn().mockImplementation(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return {
        data: [{ sportId: 10, slug: 'soccer', sportName: 'Soccer' }],
        status: 200,
        fromCache: false,
      };
    });
    const fakeClient: any = { get: getSpy };
    const discovery = new OddsPapiDiscovery(fakeClient);
    const [a, b, c] = await Promise.all([
      discovery.getSoccerSportId(),
      discovery.getSoccerSportId(),
      discovery.getSoccerSportId(),
    ]);
    expect(a).toBe(10);
    expect(b).toBe(10);
    expect(c).toBe(10);
    expect(calls).toBe(1);
  });
});

describe('Native client path joining', () => {
  it('preserves the /v4 base path in the absolute URL', async () => {
    const { createNativeOddsClient } = await import('../src/lib/data/providers/odds/native/client');
    const getSpy = vi.fn().mockResolvedValue({ data: [], status: 200, headers: new Headers(), durationMs: 1, fromCache: false });
    const fakeHttp: any = { get: getSpy };
    const native = (createNativeOddsClient as any)();
    (native as any).client = fakeHttp;
    (native as any).cooldownMap.clear();
    await native.get('/sports', { language: 'en' }, NativeSportsResponseSchema, 'sports');
    expect(getSpy).toHaveBeenCalledTimes(1);
    const calledPath: string = getSpy.mock.calls[0][0];
    // The absolute URL must keep the /v4 segment:
    expect(calledPath).toBe('https://api.oddspapi.io/v4/sports');
    expect(calledPath).not.toBe('https://api.oddspapi.io/sports');
  });

  it('preserves the /v4 base path for odds-by-tournaments', async () => {
    const { createNativeOddsClient } = await import('../src/lib/data/providers/odds/native/client');
    const getSpy = vi.fn().mockResolvedValue({ data: [], status: 200, headers: new Headers(), durationMs: 1, fromCache: false });
    const fakeHttp: any = { get: getSpy };
    const native = (createNativeOddsClient as any)();
    (native as any).client = fakeHttp;
    (native as any).cooldownMap.clear();
    await native.get('/odds-by-tournaments', { tournamentIds: '17' }, NativeOddsResponseSchema, 'odds-by-tournaments');
    expect(getSpy.mock.calls[0][0]).toBe('https://api.oddspapi.io/v4/odds-by-tournaments');
  });

  it('resolves correctly even when the path has no leading slash', async () => {
    const { createNativeOddsClient } = await import('../src/lib/data/providers/odds/native/client');
    const getSpy = vi.fn().mockResolvedValue({ data: [], status: 200, headers: new Headers(), durationMs: 1, fromCache: false });
    const fakeHttp: any = { get: getSpy };
    const native = (createNativeOddsClient as any)();
    (native as any).client = fakeHttp;
    (native as any).cooldownMap.clear();
    await native.get('markets', {}, NativeMarketsResponseSchema, 'markets');
    expect(getSpy.mock.calls[0][0]).toBe('https://api.oddspapi.io/v4/markets');
  });
});

describe('Provider odds-by-tournaments request shape', () => {
  it('sends exactly one bookmaker per request (live API constraint)', async () => {
    const getSpy = vi.fn().mockResolvedValue({ data: [], status: 200, fromCache: false });
    const fakeClient: any = { get: getSpy };
    const provider = new OddsPapiV4Provider(fakeClient);
    const discovery = new OddsPapiDiscovery(fakeClient);
    vi.spyOn(discovery, 'getSoccerMarkets').mockResolvedValue([]);
    vi.spyOn(discovery, 'getSoccerTournaments').mockResolvedValue([
      { tournamentId: 17, tournamentSlug: 'premier-league', tournamentName: 'Premier League', categoryName: 'England', futureFixtures: 10, upcomingFixtures: 2, liveFixtures: 0 },
    ]);
    vi.spyOn(discovery, 'getVerifiedSharpBookmakers').mockResolvedValue({
      verified: [
        { slug: 'pinnacle', name: 'Pinnacle' },
        { slug: 'sbobet', name: 'SBO' },
      ],
      unavailable: ['Circa'],
    });
    vi.spyOn(discovery, 'getSoccerSportId').mockResolvedValue(10);
    (provider as any).discovery = discovery;
    await provider.fetchNormalizedOdds();
    const oddsCalls = getSpy.mock.calls.filter((c: any) => String(c[0]).includes('odds-by-tournaments'));
    expect(oddsCalls).toHaveLength(2);
    expect(oddsCalls[0][1].bookmaker).toBe('pinnacle');
    expect(oddsCalls[1][1].bookmaker).toBe('sbobet');
    expect(oddsCalls[0][1]).not.toHaveProperty('bookmakers');
    expect(oddsCalls[0][1].tournamentIds).toBe('17');
    expect(oddsCalls[0][1].oddsFormat).toBe('decimal');
  });

  it('merges per-bookmaker responses by fixtureId', async () => {
    const mkFixture = (bookmaker: string, price: number) => ({
      fixtureId: 'id1000001761301153',
      participant1Id: 1,
      participant2Id: 2,
      sportId: 10,
      tournamentId: 17,
      statusId: 0,
      hasOdds: true,
      startTime: '2026-04-13T19:00:00.000Z',
      participant1Name: 'Liverpool FC',
      participant2Name: 'Manchester United',
      bookmakerOdds: {
        [bookmaker]: {
          bookmakerIsActive: true,
          suspended: false,
          markets: {
            '101': {
              marketActive: true,
              outcomes: {
                '101': { players: { '0': { active: true, price, bookmakerOutcomeId: 'home' } } },
                '102': { players: { '0': { active: true, price: 3.4, bookmakerOutcomeId: 'draw' } } },
                '103': { players: { '0': { active: true, price: 3.2, bookmakerOutcomeId: 'away' } } },
              },
            },
          },
        },
      },
    });
    const getSpy = vi.fn().mockImplementation(async (_path: any, params: any) => ({
      data: [mkFixture(params.bookmaker, params.bookmaker === 'pinnacle' ? 2.1 : 2.05)],
      status: 200,
      fromCache: false,
    }));
    const fakeClient: any = { get: getSpy };
    const provider = new OddsPapiV4Provider(fakeClient);
    const discovery = new OddsPapiDiscovery(fakeClient);
    vi.spyOn(discovery, 'getSoccerMarkets').mockResolvedValue(MARKETS.map((m) => ({ marketId: m.marketId, marketName: m.marketName, marketType: m.marketType, handicap: m.handicap, outcomes: m.outcomes })));
    vi.spyOn(discovery, 'getSoccerTournaments').mockResolvedValue([
      { tournamentId: 17, tournamentSlug: 'premier-league', tournamentName: 'Premier League', categoryName: 'England', futureFixtures: 10, upcomingFixtures: 2, liveFixtures: 0 },
    ]);
    vi.spyOn(discovery, 'getVerifiedSharpBookmakers').mockResolvedValue({
      verified: [
        { slug: 'pinnacle', name: 'Pinnacle' },
        { slug: 'sbobet', name: 'SBO' },
      ],
      unavailable: [],
    });
    vi.spyOn(discovery, 'getSoccerSportId').mockResolvedValue(10);
    (provider as any).discovery = discovery;
    const { sharp } = await provider.fetchNormalizedOdds();
    expect(sharp).toHaveLength(1);
    expect(sharp[0].bookmakers.map((b) => b.key).sort()).toEqual(['pinnacle', 'sbobet']);
    const pinnacleMl = sharp[0].bookmakers.find((b) => b.key === 'pinnacle')!.markets.find((m) => m.key === 'h2h')!;
    expect(pinnacleMl.outcomes[0].price).toBe(2.1);
  });

  it('throws no verified bookmakers error when none resolve', async () => {
    const getSpy = vi.fn().mockResolvedValue({ data: [], status: 200, fromCache: false });
    const fakeClient: any = { get: getSpy };
    const provider = new OddsPapiV4Provider(fakeClient);
    const discovery = new OddsPapiDiscovery(fakeClient);
    vi.spyOn(discovery, 'getSoccerMarkets').mockResolvedValue([]);
    vi.spyOn(discovery, 'getSoccerTournaments').mockResolvedValue([
      { tournamentId: 17, tournamentSlug: 'premier-league', tournamentName: 'Premier League', categoryName: 'England', futureFixtures: 10, upcomingFixtures: 2, liveFixtures: 0 },
    ]);
    vi.spyOn(discovery, 'getVerifiedSharpBookmakers').mockResolvedValue({
      verified: [],
      unavailable: ['Pinnacle', 'Circa', 'SBO'],
    });
    vi.spyOn(discovery, 'getSoccerSportId').mockResolvedValue(10);
    (provider as any).discovery = discovery;
    await expect(provider.fetchNormalizedOdds()).rejects.toThrow('No verified sharp bookmakers');
  });

  it('skips tournaments with no upcoming/future fixtures', async () => {
    const getSpy = vi.fn().mockResolvedValue({ data: [], status: 200, fromCache: false });
    const fakeClient: any = { get: getSpy };
    const provider = new OddsPapiV4Provider(fakeClient);
    const discovery = new OddsPapiDiscovery(fakeClient);
    vi.spyOn(discovery, 'getSoccerMarkets').mockResolvedValue([]);
    vi.spyOn(discovery, 'getSoccerTournaments').mockResolvedValue([
      { tournamentId: 17, tournamentSlug: 'premier-league', tournamentName: 'Premier League', categoryName: 'England', futureFixtures: 0, upcomingFixtures: 0, liveFixtures: 0 },
      { tournamentId: 8, tournamentSlug: 'laliga', tournamentName: 'LaLiga', categoryName: 'Spain', futureFixtures: 12, upcomingFixtures: 0, liveFixtures: 0 },
    ]);
    vi.spyOn(discovery, 'getVerifiedSharpBookmakers').mockResolvedValue({
      verified: [{ slug: 'pinnacle', name: 'Pinnacle' }],
      unavailable: [],
    });
    vi.spyOn(discovery, 'getSoccerSportId').mockResolvedValue(10);
    (provider as any).discovery = discovery;
    await provider.fetchNormalizedOdds();
    const oddsCall = getSpy.mock.calls.find((c: any) => String(c[0]).includes('odds-by-tournaments'));
    expect(oddsCall).toBeDefined();
    expect(oddsCall![1].tournamentIds).toBe('8');
  });

  it('skips a bookmaker with FIXTURE_NOT_FOUND instead of failing the cycle', async () => {
    const fixture = {
      fixtureId: 'id1000001761301153',
      participant1Id: 1,
      participant2Id: 2,
      sportId: 10,
      tournamentId: 17,
      statusId: 0,
      hasOdds: true,
      startTime: '2026-04-13T19:00:00.000Z',
      participant1Name: 'Liverpool FC',
      participant2Name: 'Manchester United',
      bookmakerOdds: {
        pinnacle: {
          bookmakerIsActive: true,
          suspended: false,
          markets: {
            '101': {
              marketActive: true,
              outcomes: {
                '101': { players: { '0': { active: true, price: 2.1, bookmakerOutcomeId: 'home' } } },
                '102': { players: { '0': { active: true, price: 3.4, bookmakerOutcomeId: 'draw' } } },
                '103': { players: { '0': { active: true, price: 3.2, bookmakerOutcomeId: 'away' } } },
              },
            },
          },
        },
      },
    };
    const getSpy = vi.fn().mockImplementation(async (_path: any, params: any) => {
      if (params.bookmaker === 'pinnacle') {
        return { data: [fixture], status: 200, fromCache: false };
      }
      throw new OddsPapiError('CONTRACT_ERROR', 'odds-by-tournaments', 'HTTP 404: No fixtures found', 404, 'FIXTURE_NOT_FOUND');
    });
    const fakeClient: any = { get: getSpy };
    const provider = new OddsPapiV4Provider(fakeClient);
    const discovery = new OddsPapiDiscovery(fakeClient);
    vi.spyOn(discovery, 'getSoccerMarkets').mockResolvedValue(MARKETS.map((m) => ({ marketId: m.marketId, marketName: m.marketName, marketType: m.marketType, handicap: m.handicap, outcomes: m.outcomes })));
    vi.spyOn(discovery, 'getSoccerTournaments').mockResolvedValue([
      { tournamentId: 17, tournamentSlug: 'premier-league', tournamentName: 'Premier League', categoryName: 'England', futureFixtures: 10, upcomingFixtures: 2, liveFixtures: 0 },
    ]);
    vi.spyOn(discovery, 'getVerifiedSharpBookmakers').mockResolvedValue({
      verified: [
        { slug: 'pinnacle', name: 'Pinnacle' },
        { slug: 'sbobet', name: 'SBO' },
      ],
      unavailable: [],
    });
    vi.spyOn(discovery, 'getSoccerSportId').mockResolvedValue(10);
    (provider as any).discovery = discovery;
    const { sharp, snapshots } = await provider.fetchNormalizedOdds();
    expect(sharp).toHaveLength(1);
    expect(sharp[0].bookmakers.map((b) => b.key)).toEqual(['pinnacle']);
    expect(snapshots.length).toBeGreaterThan(0);
    expect(getSpy).toHaveBeenCalledTimes(2); // pinnacle + sbobet
  });
});
