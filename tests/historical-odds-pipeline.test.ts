import { describe, it, expect } from 'vitest';
import type { HistoricalOddPoint } from '@/lib/data/providers/odds/native/normalize';
import {
  classifyCatalogMarket,
  outcomeSide,
  type CatalogMarket,
} from '@/historical/oddspapi/marketCatalog';
import {
  selectEntryClosing,
  buildMarketObservationSets,
} from '@/historical/oddspapi/observationSeries';
import { buildHistoricalOddsRows } from '@/historical/oddspapi/storageRows';

const KICKOFF = Date.parse('2026-02-01T14:00:00.000Z');

function catalogMarket(overrides: Partial<CatalogMarket> = {}): CatalogMarket {
  return {
    marketId: 108,
    marketName: 'Over Under Full Time',
    marketType: 'totals',
    handicap: 2.5,
    outcomes: [
      { outcomeId: 108, outcomeName: 'Over' },
      { outcomeId: 109, outcomeName: 'Under' },
    ],
    ...overrides,
  };
}

function point(overrides: Partial<HistoricalOddPoint> = {}): HistoricalOddPoint {
  return {
    fixtureId: 'id-test',
    bookmaker: 'pinnacle',
    marketId: 108,
    outcomeId: 108,
    playerKey: '0',
    createdAt: '2026-01-28T12:00:00.000Z',
    price: 1.95,
    limit: 1000,
    active: true,
    exchangeMeta: null,
    ...overrides,
  };
}

describe('market catalog classification', () => {
  it('classifies real OddsPapi market types with their lines', () => {
    expect(classifyCatalogMarket(catalogMarket({ marketId: 101, marketType: '1x2', marketName: 'Full Time Result', handicap: 0 }))).toEqual({ market: 'ML', line: null });
    expect(classifyCatalogMarket(catalogMarket({ marketId: 104, marketType: 'bothteamsscore', marketName: 'Both Teams To Score', handicap: 0 }))).toEqual({ market: 'BTTS', line: null });
    expect(classifyCatalogMarket(catalogMarket({ marketId: 108, marketType: 'totals', handicap: 1.5 }))).toEqual({ market: 'OU', line: 1.5 });
    expect(classifyCatalogMarket(catalogMarket({ marketId: 1058, marketType: 'spreads', marketName: 'Asian Handicap', handicap: -1.75 }))).toEqual({ market: 'AH', line: -1.75 });
  });

  it('marks missing lines instead of guessing', () => {
    expect(classifyCatalogMarket(catalogMarket({ handicap: null }))).toEqual({ market: 'OU', line: null });
  });

  it('does not classify unsupported markets', () => {
    expect(classifyCatalogMarket(catalogMarket({ marketType: 'corners', marketName: 'Total Corners' }))).toBeNull();
  });

  it('maps outcome names to canonical sides', () => {
    expect(outcomeSide('ML', '1')).toBe('home');
    expect(outcomeSide('ML', 'X')).toBe('draw');
    expect(outcomeSide('ML', '2')).toBe('away');
    expect(outcomeSide('OU', 'Over')).toBe('over');
    expect(outcomeSide('OU', 'Under')).toBe('under');
    expect(outcomeSide('AH', '1')).toBe('home');
    expect(outcomeSide('BTTS', 'Yes')).toBe('yes');
    expect(outcomeSide('BTTS', 'No')).toBe('no');
    expect(outcomeSide('ML', 'Unknown')).toBeNull();
  });
});

describe('entry / closing selection (timestamp-aware)', () => {
  it('selects the earliest entry and the latest pre-kickoff closing', () => {
    const result = selectEntryClosing(
      [
        { createdAt: '2026-01-15T10:00:00.000Z', price: 2.0, limit: null }, // outside 14d window
        { createdAt: '2026-01-28T10:00:00.000Z', price: 1.95, limit: null }, // entry
        { createdAt: '2026-01-31T20:00:00.000Z', price: 1.9, limit: null },
        { createdAt: '2026-02-01T13:59:00.000Z', price: 1.88, limit: null }, // closing
      ],
      KICKOFF
    );

    expect(result.entry?.createdAt).toBe('2026-01-28T10:00:00.000Z');
    expect(result.closing?.createdAt).toBe('2026-02-01T13:59:00.000Z');
    expect(result.outsideWindow).toBe(1);
    expect(result.closingAfterKickoffRejected).toBe(0);
  });

  it('rejects observations after kickoff (in-play) and never uses them as closing', () => {
    const result = selectEntryClosing(
      [
        { createdAt: '2026-01-30T10:00:00.000Z', price: 1.9, limit: null },
        { createdAt: '2026-02-01T15:00:00.000Z', price: 2.5, limit: null }, // in-play
      ],
      KICKOFF
    );

    expect(result.closing?.createdAt).toBe('2026-01-30T10:00:00.000Z');
    expect(result.closingAfterKickoffRejected).toBe(1);
  });

  it('returns unavailable closing when only in-play observations exist', () => {
    const result = selectEntryClosing(
      [{ createdAt: '2026-02-01T15:00:00.000Z', price: 2.5, limit: null }],
      KICKOFF
    );

    expect(result.entry).toBeNull();
    expect(result.closing).toBeNull();
    expect(result.closingAfterKickoffRejected).toBe(1);
  });

  it('counts invalid timestamps', () => {
    const result = selectEntryClosing(
      [
        { createdAt: 'not-a-date', price: 1.9, limit: null },
        { createdAt: '2026-01-30T10:00:00.000Z', price: 1.9, limit: null },
      ],
      KICKOFF
    );

    expect(result.invalidTimestamp).toBe(1);
    expect(result.closing).not.toBeNull();
  });
});

describe('observation sets and storage rows', () => {
  const catalog = new Map<number, CatalogMarket>([
    [108, catalogMarket()],
    [1058, catalogMarket({ marketId: 1058, marketName: 'Asian Handicap', marketType: 'spreads', handicap: -0.5, outcomes: [{ outcomeId: 1058, outcomeName: '1' }, { outcomeId: 1059, outcomeName: '2' }] })],
    [1059, catalogMarket({ marketId: 1059, marketName: 'Asian Handicap', marketType: 'spreads', handicap: -0.75, outcomes: [{ outcomeId: 1058, outcomeName: '1' }, { outcomeId: 1059, outcomeName: '2' }] })],
  ]);

  it('preserves distinct AH lines as distinct rows', () => {
    const points: HistoricalOddPoint[] = [
      point({ marketId: 1058, outcomeId: 1058, price: 1.95, createdAt: '2026-01-28T10:00:00.000Z' }),
      point({ marketId: 1058, outcomeId: 1059, price: 1.95, createdAt: '2026-01-28T10:00:00.000Z' }),
      point({ marketId: 1059, outcomeId: 1058, price: 2.05, createdAt: '2026-01-28T10:00:00.000Z' }),
      point({ marketId: 1059, outcomeId: 1059, price: 1.85, createdAt: '2026-01-28T10:00:00.000Z' }),
    ];

    const { sets } = buildMarketObservationSets(points, catalog, KICKOFF);
    const rows = sets.flatMap((set) =>
      buildHistoricalOddsRows({
        set,
        bookmaker: 'pinnacle',
        provider: 'oddspapi',
        providerEventId: 'id-test',
        canonicalId: 'ENG-PL|2025-2026|2026-02-01|home|away',
        leagueId: 'ENG-PL',
        cluster: 'A',
        season: '2025-2026',
        matchDate: '2026-02-01',
        datasetVersion: 'test',
        ingestionVersion: 'test',
      }).rows
    );

    const lines = rows
      .filter((r) => r.market === 'AH')
      .map((r) => r.line as number)
      .sort((a, b) => a - b);
    expect(lines).toEqual([-0.75, -0.75, -0.5, -0.5]);
    for (const row of rows) {
      expect(row.line).not.toBeNull();
      expect(row.odds_id).toHaveLength(64);
    }
  });

  it('never uses an in-play observation as closing', () => {
    const points: HistoricalOddPoint[] = [
      point({ marketId: 108, outcomeId: 108, createdAt: '2026-01-28T10:00:00.000Z' }),
      point({ marketId: 108, outcomeId: 109, createdAt: '2026-01-28T10:00:00.000Z' }),
      point({ marketId: 108, outcomeId: 108, createdAt: '2026-02-01T15:00:00.000Z' }), // in-play only
      point({ marketId: 108, outcomeId: 109, createdAt: '2026-02-01T15:00:00.000Z' }),
    ];

    const { sets } = buildMarketObservationSets(points, catalog, KICKOFF);
    const result = buildHistoricalOddsRows({
      set: sets[0],
      bookmaker: 'pinnacle',
      provider: 'oddspapi',
      providerEventId: 'id-test',
      canonicalId: 'ENG-PL|2025-2026|2026-02-01|home|away',
      leagueId: 'ENG-PL',
      cluster: 'A',
      season: '2025-2026',
      matchDate: '2026-02-01',
      datasetVersion: 'test',
      ingestionVersion: 'test',
    });

    const closingRow = result.rows.find((r) => r.observation === 'closing');
    expect(closingRow?.over_odds).toBe(1.95);
    expect(closingRow?.under_odds).toBe(1.95);
    expect(closingRow?.odds_timestamp).toBe('2026-01-28T10:00:00.000Z');
  });

  it('classifies partial books without dropping the real observation', () => {
    const mlCatalog = new Map<number, CatalogMarket>([
      [
        101,
        catalogMarket({
          marketId: 101,
          marketName: 'Full Time Result',
          marketType: '1x2',
          handicap: 0,
          outcomes: [
            { outcomeId: 101, outcomeName: '1' },
            { outcomeId: 102, outcomeName: 'X' },
            { outcomeId: 103, outcomeName: '2' },
          ],
        }),
      ],
    ]);
    // Only home + away exist; draw side is missing from the provider data.
    const points: HistoricalOddPoint[] = [
      point({ marketId: 101, outcomeId: 101, price: 2.1 }),
      point({ marketId: 101, outcomeId: 103, price: 3.4 }),
    ];
    const { sets } = buildMarketObservationSets(points, mlCatalog, KICKOFF);
    const result = buildHistoricalOddsRows({
      set: sets[0],
      bookmaker: 'pinnacle',
      provider: 'oddspapi',
      providerEventId: 'id-test',
      canonicalId: 'x',
      leagueId: 'ENG-PL',
      cluster: 'A',
      season: 's',
      matchDate: '2026-02-01',
      datasetVersion: 'test',
      ingestionVersion: 'test',
    });

    expect(result.partialBooks).toHaveLength(2); // opening + closing
    expect(result.partialBooks[0]).toMatchObject({ market: 'ML', sides: 2, expected: 3 });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].draw_odds).toBeNull();
  });

  it('rejects markets whose line is missing', () => {
    const missingLineCatalog = new Map<number, CatalogMarket>([
      [108, catalogMarket({ handicap: null })],
    ]);
    const points: HistoricalOddPoint[] = [
      point({ marketId: 108, outcomeId: 108 }),
      point({ marketId: 108, outcomeId: 109 }),
    ];
    const { sets } = buildMarketObservationSets(points, missingLineCatalog, KICKOFF);
    expect(sets[0].status).toBe('MISSING_LINE');

    const result = buildHistoricalOddsRows({
      set: sets[0],
      bookmaker: 'pinnacle',
      provider: 'oddspapi',
      providerEventId: 'id-test',
      canonicalId: 'x',
      leagueId: 'ENG-PL',
      cluster: 'A',
      season: 's',
      matchDate: '2026-02-01',
      datasetVersion: 'test',
      ingestionVersion: 'test',
    });
    expect(result.rows).toHaveLength(0);
    expect(result.rejections[0].reason).toBe('LINE_MISSING');
  });

  it('counts unsupported markets without guessing them', () => {
    const unsupportedCatalog = new Map<number, CatalogMarket>([
      [900, catalogMarket({ marketId: 900, marketType: 'corners', marketName: 'Corners' })],
    ]);
    const { sets, unsupportedMarketIds } = buildMarketObservationSets(
      [point({ marketId: 900 })],
      unsupportedCatalog,
      KICKOFF
    );
    expect(sets).toHaveLength(0);
    expect(unsupportedMarketIds).toEqual([900]);
  });

  it('preserves per-side timestamps in the storage row', () => {
    const points: HistoricalOddPoint[] = [
      point({ marketId: 108, outcomeId: 108, createdAt: '2026-01-28T10:00:00.000Z' }),
      point({ marketId: 108, outcomeId: 109, createdAt: '2026-01-28T11:30:00.000Z' }),
    ];
    const { sets } = buildMarketObservationSets(points, catalog, KICKOFF);
    const { rows } = buildHistoricalOddsRows({
      set: sets[0],
      bookmaker: 'pinnacle',
      provider: 'oddspapi',
      providerEventId: 'id-test',
      canonicalId: 'x',
      leagueId: 'ENG-PL',
      cluster: 'A',
      season: 's',
      matchDate: '2026-02-01',
      datasetVersion: 'test',
      ingestionVersion: 'test',
    });

    const opening = rows.find((r) => r.observation === 'opening');
    expect(opening?.home_odds_timestamp).toBe('2026-01-28T10:00:00.000Z');
    expect(opening?.away_odds_timestamp).toBe('2026-01-28T11:30:00.000Z');
    expect(opening?.odds_timestamp).toBe('2026-01-28T11:30:00.000Z');
    expect(opening?.provider).toBe('oddspapi');
    expect(opening?.provider_event_id).toBe('id-test');
    expect(opening?.market_id).toBe(108);
  });
});
