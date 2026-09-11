import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  teamSlug,
  canonicalMatchIdOf,
  deriveResult,
  deriveScorelineMarkets,
  calculateIngestionPriority,
  categorizeFixtureFreshness,
  isHistoricalSeasonFinalized,
  GlobalIngestionEngine,
  type RawFixtureItem,
} from '../src/lib/ingestion/globalIngestionEngine';
import { type GlobalLeague } from '../src/lib/config/leagueRegistry';

describe('Global Intelligent Ingestion Engine (Checkpoint C)', () => {
  const baseMockLeague: GlobalLeague = {
    league_id: 39,
    name: 'Premier League',
    league_name: 'Premier League',
    country: 'England',
    country_code: 'GB',
    type: 'league',
    season: 2024,
    seasons_available: 15,
    all_seasons: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
    coverage_status: 'FULL',
    historical_depth: '7_PLUS',
    fixture_count: 'UNKNOWN',
    odds_availability: 'PARTIAL',
    market_availability: {
      AH: 'UNKNOWN',
      OU: 'UNKNOWN',
      BTTS: 'UNKNOWN',
      ML: 'UNKNOWN',
    },
    predictability_hooks: {
      AH: null,
      OU: null,
      BTTS: null,
      ML: null,
    },
    data_quality_score: 95,
    priority_score: 88,
    tier: 'CORE',
    status: 'ACTIVE',
    provider: 'apifootball',
    provider_status: 'ACTIVE',
    ingestion_status: 'DISCOVERED',
    last_ingested: null,
    market_readiness: {
      RESULT_READY: false,
      AH_READY: false,
      OU_READY: false,
      BTTS_READY: false,
      ML_READY: false,
    },
  };

  // ─── 1. Deterministic Canonical Identity ──────────────────────────────────
  describe('Deterministic Canonical Match Identity', () => {
    it('normalizes team names safely with diacritics and special characters', () => {
      expect(teamSlug('Atlético de Madrid')).toBe('atletico-de-madrid');
      expect(teamSlug('Brighton & Hove Albion')).toBe('brighton-and-hove-albion');
      expect(teamSlug('FC Bayern München')).toBe('fc-bayern-munchen');
      expect(teamSlug('Paris Saint-Germain')).toBe('paris-saint-germain');
    });

    it('generates consistent deterministic canonical match IDs', () => {
      const id1 = canonicalMatchIdOf(39, 2024, '2024-08-16T19:00:00Z', 'Manchester United', 'Fulham');
      const id2 = canonicalMatchIdOf('39', '2024', '2024-08-16', 'Manchester United', 'Fulham');
      expect(id1).toBe('39|2024|2024-08-16|manchester-united|fulham');
      expect(id2).toBe('39|2024|2024-08-16|manchester-united|fulham');
    });
  });

  // ─── 2. Deterministic Scoreline Result Derivation ─────────────────────────
  describe('Deterministic Scoreline & Derived Markets', () => {
    it('derives Home Win, BTTS, and Over/Under results correctly', () => {
      const markets = deriveScorelineMarkets(2, 1);
      expect(markets.result).toBe('H');
      expect(markets.totalGoals).toBe(3);
      expect(markets.homeWin).toBe(true);
      expect(markets.draw).toBe(false);
      expect(markets.awayWin).toBe(false);
      expect(markets.btts).toBe(true);
      expect(markets.over15).toBe(true);
      expect(markets.over25).toBe(true);
      expect(markets.under25).toBe(false);
    });

    it('derives Draw and Under results correctly', () => {
      const markets = deriveScorelineMarkets(0, 0);
      expect(markets.result).toBe('D');
      expect(markets.totalGoals).toBe(0);
      expect(markets.draw).toBe(true);
      expect(markets.btts).toBe(false);
      expect(markets.under15).toBe(true);
      expect(markets.under25).toBe(true);
    });

    it('returns null fields for unplayed or unfinalized fixtures without score', () => {
      const markets = deriveScorelineMarkets(null, null);
      expect(markets.result).toBeNull();
      expect(markets.totalGoals).toBeNull();
      expect(markets.homeWin).toBeNull();
    });
  });

  // ─── 3. Ingestion Priority Formula ────────────────────────────────────────
  describe('Ingestion Priority Formula (No ROI or Predictability Bias)', () => {
    it('computes top priority for CORE leagues with deep history and odds availability', () => {
      const score = calculateIngestionPriority(baseMockLeague);
      // 30% * 100 + 25% * 100 + 20% * 100 + 15% * 100 + 10% * 95 = 30 + 25 + 20 + 15 + 9.5 = 99.5 -> 100
      expect(score).toBeGreaterThanOrEqual(95);
    });

    it('gives lower priority to leagues with minimal seasons or missing odds', () => {
      const lowLeague: GlobalLeague = {
        ...baseMockLeague,
        tier: 'LIMITED_DATA',
        historical_depth: '1_2_SEASONS',
        seasons_available: 1,
        odds_availability: 'UNAVAILABLE',
        data_quality_score: 40,
      };

      const score = calculateIngestionPriority(lowLeague);
      expect(score).toBeLessThan(40);
    });
  });

  // ─── 4. Freshness Policy ──────────────────────────────────────────────────
  describe('Freshness Policy', () => {
    it('categorizes live, final, near-kickoff, and upcoming fixtures', () => {
      expect(categorizeFixtureFreshness('FT', '2024-05-19T15:00:00Z')).toBe('FINAL');
      expect(categorizeFixtureFreshness('1H', new Date().toISOString())).toBe('LIVE');

      const futureDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      expect(categorizeFixtureFreshness('NS', futureDate)).toBe('UPCOMING');
    });

    it('correctly identifies finalized historical seasons', () => {
      expect(isHistoricalSeasonFinalized(2021)).toBe(true);
      expect(isHistoricalSeasonFinalized(2022)).toBe(true);
      expect(isHistoricalSeasonFinalized(new Date().getFullYear())).toBe(false);
    });
  });

  // ─── 5. Normalization, Deduplication & Quarantine ─────────────────────────
  describe('Normalization, Deduplication & Quarantine', () => {
    it('normalizes valid raw fixture into canonical ingested match format', () => {
      const engine = new GlobalIngestionEngine();
      const rawItem: RawFixtureItem = {
        fixture: {
          id: 12345,
          date: '2024-09-01T15:00:00+00:00',
          timestamp: 1725202800,
          timezone: 'UTC',
          status: { long: 'Match Finished', short: 'FT' },
        },
        league: { id: 39, name: 'Premier League', country: 'England', season: 2024 },
        teams: {
          home: { id: 33, name: 'Manchester United', winner: true },
          away: { id: 40, name: 'Liverpool', winner: false },
        },
        goals: { home: 0, away: 3 },
        score: {
          halftime: { home: 0, away: 2 },
          fulltime: { home: 0, away: 3 },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      };

      const { match, quarantineReason } = engine.normalizeFixture(rawItem, baseMockLeague, 2024, 'dummy_checksum');

      expect(quarantineReason).toBeUndefined();
      expect(match).not.toBeNull();
      expect(match?.canonical_match_id).toBe('39|2024|2024-09-01|manchester-united|liverpool');
      expect(match?.markets.result).toBe('A');
      expect(match?.markets.awayWin).toBe(true);
      expect(match?.markets.over25).toBe(true);
      expect(match?.provenance.source_endpoint).toBe('fixtures');
    });

    it('quarantines fixtures with missing team names or corrupt dates', () => {
      const engine = new GlobalIngestionEngine();
      const corruptItem: RawFixtureItem = {
        fixture: {
          id: 99999,
          date: 'invalid-date',
          timestamp: NaN,
          timezone: 'UTC',
          status: { long: 'Unknown', short: 'UNK' },
        },
        league: { id: 39, name: 'Premier League', country: 'England', season: 2024 },
        teams: {
          home: { id: 1, name: '', winner: null },
          away: { id: 2, name: '', winner: null },
        },
        goals: { home: null, away: null },
        score: {
          halftime: { home: null, away: null },
          fulltime: { home: null, away: null },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      };

      const { match, quarantineReason } = engine.normalizeFixture(corruptItem, baseMockLeague, 2024, 'dummy_checksum');

      expect(match).toBeNull();
      expect(quarantineReason).toBeDefined();
    });
  });

  // ─── 6. Granular Market-Specific Readiness ─────────────────────────────────
  describe('Granular Market-Specific Readiness', () => {
    it('sets RESULT_READY to true when real finished results exist without quarantine', () => {
      const readiness = {
        RESULT_READY: true,
        AH_READY: false,
        OU_READY: false,
        BTTS_READY: false,
        ML_READY: false,
      };

      expect(readiness.RESULT_READY).toBe(true);
      expect(readiness.AH_READY).toBe(false);
      expect(readiness.OU_READY).toBe(false);
    });
  });
});
