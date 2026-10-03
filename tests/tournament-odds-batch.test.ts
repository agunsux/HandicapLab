/**
 * SALMO P0 — Tournament-level odds batch (OddsPapi v4)
 *
 * Verifies the quota architecture that replaces the per-fixture
 * /v4/odds?fixtureId= fan-out with /v4/odds-by-tournaments:
 *   - aggregated odds parsing + bookmaker merging
 *   - AH / OU / BTTS market semantics preserved verbatim
 *   - fixture mapping
 *   - quota reservation routed through the native client (no raw fetch)
 *   - quota estimation model
 *   - fail-safe: DEGRADED, never a fan-out fallback
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  primeTournamentOdds,
  getBatchedFixtureOdds,
  getLastBatchResult,
  isBatchReady,
  estimateQuota,
  fetchOddsPapiFixtureIndex,
  __setBatchClientForTests,
  __resetTournamentOddsBatch,
  CONSUMED_BOOKMAKERS,
} from '@/lib/pipeline/tournamentOddsBatch';
import { OddsPapiError } from '@/lib/data/providers/odds/native';

// ─── Fixtures built to the provider's real shape ─────────────────────────────
// Market ids are the live OddsPapi ids used by the pipelines:
//   1072 = Asian Handicap 0 (full time)   1010 = Over Under 2.5 (full time)
//   104  = Both Teams To Score
function ahFixture(fixtureId: string, price: number, changedAt: string) {
  return {
    fixtureId,
    participant1Id: 1,
    participant2Id: 2,
    sportId: 10,
    tournamentId: 17,
    statusId: 1,
    hasOdds: true,
    startTime: '2026-10-03T14:00:00.000Z',
    bookmakerOdds: {
      pinnacle: {
        markets: {
          '1072': { outcomes: { '0': { players: { '0': { price, changedAt, limit: 5000 } } } } },
          '1010': { outcomes: { '1': { players: { '0': { price: price + 0.1, changedAt } } } } },
          '104': { outcomes: { '1': { players: { '0': { price: 1.95, changedAt } } } } },
        },
      },
    },
  };
}

function makeClient(handler: (path: string, params: any, endpoint: string) => any) {
  return {
    get: vi.fn(async (path: string, params: any, _schema: any, endpoint: string) => handler(path, params, endpoint)),
  } as any;
}

const ok = (data: any) => ({ data, status: 200, fromCache: false });

beforeEach(() => {
  __resetTournamentOddsBatch();
  __setBatchClientForTests(null);
});

describe('P0 quota model (estimateQuota)', () => {
  it('models the current per-fixture fan-out against a 250/month hard limit', () => {
    const m = estimateQuota({ cyclesPerDay: 1, fixturesPerService: 12, services: 3, bookmakers: 2 });
    // 30 cycles x 3 services = 90 discovery calls; 90 x 12 = 1080 odds calls
    expect(m.current.fixturesCalls).toBe(90);
    expect(m.current.oddsCalls).toBe(1080);
    expect(m.current.total).toBe(1170);
    expect(m.current.pctOfHard).toBeGreaterThan(400); // previously ~468% of quota
  });

  it('models the proposed shared batch as a small fraction of quota', () => {
    const m = estimateQuota({ cyclesPerDay: 1, fixturesPerService: 12, services: 3, bookmakers: 2 });
    // 30 shared discovery calls + 30 x 2 bookmaker batch calls
    expect(m.proposed.fixturesCalls).toBe(30);
    expect(m.proposed.oddsCalls).toBe(60);
    expect(m.proposed.total).toBe(90);
    expect(m.proposed.total).toBeLessThan(m.hardLimit);
    expect(m.proposed.pctOfHard).toBeCloseTo(36.0, 1);
  });

  it('does not silently claim the <50/month preferred target at 1 cycle/day', () => {
    const m = estimateQuota({ cyclesPerDay: 1, bookmakers: 2, services: 3, fixturesPerService: 12 });
    expect(m.proposed.total).toBeGreaterThan(50);
  });
});

describe('primeTournamentOdds — parsing, merging and fixture mapping', () => {
  it('maps fixtures by fixtureId and merges bookmaker records into one entry', async () => {
    const client = makeClient((_p, params) =>
      params.bookmaker === 'pinnacle'
        ? ok([ahFixture('fx-1', 1.91, 'T1'), ahFixture('fx-2', 2.05, 'T2')])
        : ok([
            {
              ...ahFixture('fx-1', 3.4, 'T1'),
              bookmakerOdds: {
                sbobet: { markets: { '1072': { outcomes: { '1': { players: { '0': { price: 1.88, changedAt: 'T1' } } } } } } },
              },
            },
          ])
    );
    __setBatchClientForTests(client);

    const res = await primeTournamentOdds({ tournamentIds: [17] });
    expect(res.status).toBe('READY');
    expect(res.fixtureCount).toBe(2);
    expect(res.bookmakersWithData).toEqual(['pinnacle', 'sbobet']);
    expect(res.meteredCalls).toBe(2); // exactly one request per consumed bookmaker

    const merged = getBatchedFixtureOdds('fx-1');
    expect(merged).not.toBeNull();
    expect(Object.keys(merged!.bookmakerOdds).sort()).toEqual(['pinnacle', 'sbobet']);
    expect(merged!.fixtureId).toBe('fx-1');
    expect(merged!.tournamentId).toBe(17);
    expect(merged!.startTime).toBe('2026-10-03T14:00:00.000Z');
  });

  it('requests only the batch endpoint, for exactly the consumed bookmakers', async () => {
    const client = makeClient(() => ok([]));
    __setBatchClientForTests(client);
    await primeTournamentOdds({ tournamentIds: [17] });

    const paths = client.get.mock.calls.map((c: any[]) => c[0]);
    const endpoints = client.get.mock.calls.map((c: any[]) => c[3]);
    expect(paths.every((p: string) => p === '/odds-by-tournaments')).toBe(true);
    expect(endpoints.every((e: string) => e === 'odds-by-tournaments')).toBe(true);
    expect(paths.some((p: string) => p === '/odds')).toBe(false); // never per-fixture
    expect(client.get.mock.calls.map((c: any[]) => c[1].bookmaker).sort()).toEqual(
      [...CONSUMED_BOOKMAKERS].sort()
    );
  });

  it('passes tournamentIds through chunked into max 5 per request and sets decimal odds format', async () => {
    const client = makeClient(() => ok([ahFixture('fx-1', 1.9, 'T')]));
    __setBatchClientForTests(client);
    await primeTournamentOdds({ tournamentIds: [17, 701], bookmakers: ['pinnacle'] });
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.get.mock.calls[0][1].tournamentIds).toBe('17,701');
    expect(client.get.mock.calls[0][1].oddsFormat).toBe('decimal');
  });

  it('chunks 6 tournament IDs into 2 requests per bookmaker (5 + 1)', async () => {
    const client = makeClient(() => ok([ahFixture('fx-1', 1.9, 'T')]));
    __setBatchClientForTests(client);
    const res = await primeTournamentOdds({ tournamentIds: [1, 2, 3, 4, 5, 6], bookmakers: ['pinnacle'] });
    expect(res.status).toBe('READY');
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(client.get.mock.calls[0][1].tournamentIds).toBe('1,2,3,4,5');
    expect(client.get.mock.calls[1][1].tournamentIds).toBe('6');
  });

  it('deduplicates, trims, and sorts tournament IDs before chunking', async () => {
    const client = makeClient(() => ok([ahFixture('fx-1', 1.9, 'T')]));
    __setBatchClientForTests(client);
    await primeTournamentOdds({ tournamentIds: [' 5 ', '2', 2, '5', '1', 10, '3', '4'], bookmakers: ['pinnacle'] });
    // Unique sorted: 1, 2, 3, 4, 5, 10 -> chunk 1: 1,2,3,4,5; chunk 2: 10
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(client.get.mock.calls[0][1].tournamentIds).toBe('1,2,3,4,5');
    expect(client.get.mock.calls[1][1].tournamentIds).toBe('10');
  });
});

describe('market semantics preserved (AH / OU / BTTS)', () => {
  it('exposes untouched provider prices and per-tick timestamps for all three markets', async () => {
    __setBatchClientForTests(makeClient(() => ok([ahFixture('fx-9', 1.907, '2026-10-02T09:31:07.123Z')])));
    await primeTournamentOdds({ tournamentIds: [17], bookmakers: ['pinnacle'] });

    const bm = getBatchedFixtureOdds('fx-9')!.bookmakerOdds.pinnacle.markets;
    // AH — no rounding, no line rewriting, no quarter-line collapse
    expect(bm['1072'].outcomes['0'].players['0'].price).toBe(1.907);
    expect(bm['1072'].outcomes['0'].players['0'].changedAt).toBe('2026-10-02T09:31:07.123Z');
    expect(bm['1072'].outcomes['0'].players['0'].limit).toBe(5000);
    // OU ladder line preserved exactly
    expect(bm['1010'].outcomes['1'].players['0'].price).toBeCloseTo(2.007, 10);
    // BTTS priced
    expect(bm['104'].outcomes['1'].players['0'].price).toBe(1.95);
  });

  it('does not add, drop or rename any bookmaker key', async () => {
    __setBatchClientForTests(makeClient(() => ok([ahFixture('fx-3', 1.9, 'T')])));
    await primeTournamentOdds({ tournamentIds: [17], bookmakers: ['pinnacle'] });
    expect(Object.keys(getBatchedFixtureOdds('fx-3')!.bookmakerOdds)).toEqual(['pinnacle']);
  });
});

describe('fail-safe behaviour (no fan-out fallback)', () => {
  it('treats a 404 FIXTURE_NOT_FOUND bookmaker as expected and keeps the cycle READY', async () => {
    __setBatchClientForTests(
      makeClient((_p, params) => {
        if (params.bookmaker === 'sbobet') {
          throw new OddsPapiError('CONTRACT_ERROR', 'odds-by-tournaments', 'no odds', 404, 'FIXTURE_NOT_FOUND');
        }
        return ok([ahFixture('fx-1', 1.9, 'T')]);
      })
    );
    const res = await primeTournamentOdds({ tournamentIds: [701] });
    expect(res.status).toBe('READY');
    expect(res.bookmakersWithData).toEqual(['pinnacle']);
    expect(getBatchedFixtureOdds('fx-1')).not.toBeNull();
  });

  it('degrades to DEGRADED (never fans out) when every bookmaker fails', async () => {
    const client = makeClient(() => {
      throw new OddsPapiError('CONTRACT_ERROR', 'odds-by-tournaments', 'boom', 500, 'SERVER_ERROR');
    });
    __setBatchClientForTests(client);

    const res = await primeTournamentOdds({ tournamentIds: [17] });
    expect(res.status).toBe('DEGRADED');
    expect(res.fixtureCount).toBe(0);
    expect(res.error).toContain('pinnacle');
    expect(getBatchedFixtureOdds('fx-1')).toBeNull(); // callers must emit DATA_UNAVAILABLE
    expect(isBatchReady()).toBe(false);
    // No per-fixture call was ever attempted as a fallback.
    expect(client.get.mock.calls.every((c: any[]) => c[0] === '/odds-by-tournaments')).toBe(true);
  });

  it('stops immediately on QUOTA and does not keep spending on further bookmakers', async () => {
    const client = makeClient(() => {
      throw new OddsPapiError('QUOTA', 'odds-by-tournaments', 'Quota blocked: ODDS_QUOTA_EXHAUSTED');
    });
    __setBatchClientForTests(client);

    const res = await primeTournamentOdds({ tournamentIds: [17] });
    expect(res.status).toBe('DEGRADED');
    expect(client.get).toHaveBeenCalledTimes(1); // broke out after the first QUOTA
    expect(getLastBatchResult()!.errorCode).toBe('QUOTA');
  });

  it('reports DEGRADED with no provider call when no tournaments are supplied', async () => {
    const client = makeClient(() => ok([]));
    __setBatchClientForTests(client);
    const res = await primeTournamentOdds({ tournamentIds: [] });
    expect(res.status).toBe('DEGRADED');
    expect(client.get).not.toHaveBeenCalled();
  });
});

describe('shared cache — the three pipelines share one batch', () => {
  it('serves the second prime from cache with zero additional metered calls', async () => {
    const client = makeClient(() => ok([ahFixture('fx-1', 1.9, 'T')]));
    __setBatchClientForTests(client);

    const first = await primeTournamentOdds({ tournamentIds: [17] });
    expect(first.fromCache).toBe(false);
    expect(client.get).toHaveBeenCalledTimes(2);

    const second = await primeTournamentOdds({ tournamentIds: [17] });
    expect(second.fromCache).toBe(true);
    expect(second.meteredCalls).toBe(0);
    expect(client.get).toHaveBeenCalledTimes(2); // unchanged
    expect(second.fixtureCount).toBe(1);
  });

  it('does not cache a DEGRADED result (no sticky degradation)', async () => {
    let fail = true;
    const client = makeClient(() => {
      if (fail) throw new OddsPapiError('NETWORK', 'odds-by-tournaments', 'timeout');
      return ok([ahFixture('fx-1', 1.9, 'T')]);
    });
    __setBatchClientForTests(client);

    expect((await primeTournamentOdds({ tournamentIds: [17] })).status).toBe('DEGRADED');
    fail = false;
    const second = await primeTournamentOdds({ tournamentIds: [17] });
    expect(second.status).toBe('READY');
    expect(second.fromCache).toBe(false);
    expect(getBatchedFixtureOdds('fx-1')).not.toBeNull();
  });
});

describe('fetchOddsPapiFixtureIndex — quota-accounted discovery', () => {
  it('maps the discovery payload to identity fields the pipelines consume', async () => {
    __setBatchClientForTests(
      makeClient(() =>
        ok([
          {
            fixtureId: 'fx-1',
            participant1Name: 'Arsenal',
            participant2Name: 'Chelsea',
            tournamentId: 17,
            tournamentName: 'Premier League',
            startTime: '2026-10-03T14:00:00.000Z',
            hasOdds: true,
            sportId: 10,
          },
        ])
      )
    );
    const idx = await fetchOddsPapiFixtureIndex({ from: '2026-10-02', to: '2026-10-09' });
    expect(idx.status).toBe('READY');
    expect(idx.meteredCalls).toBe(1);
    expect(idx.fixtures).toHaveLength(1);
    expect(idx.fixtures[0]).toMatchObject({
      fixtureId: 'fx-1',
      participant1Name: 'Arsenal',
      participant2Name: 'Chelsea',
      tournamentId: 17,
      startTime: '2026-10-03T14:00:00.000Z',
    });
  });

  it('returns DEGRADED (never throws) when the discovery call fails', async () => {
    __setBatchClientForTests(
      makeClient(() => {
        throw new OddsPapiError('INVALID_KEY', 'fixtures', '401');
      })
    );
    const idx = await fetchOddsPapiFixtureIndex({ from: '2026-10-02', to: '2026-10-09' });
    expect(idx.status).toBe('DEGRADED');
    expect(idx.fixtures).toEqual([]);
    expect(idx.errorCode).toBe('INVALID_KEY');
  });
});


