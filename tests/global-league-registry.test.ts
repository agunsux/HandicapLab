import { describe, it, expect } from 'vitest';
import {
  classifyLeague,
  calculateHistoricalDepth,
  buildCoverageMatrix,
  type GlobalLeague,
  type LeagueTier,
  type HistoricalDepth,
  type MarketCoverageState,
} from '../src/lib/config/leagueRegistry';
import { ApiFootballLeagueItemSchema, type ApiFootballLeagueItem } from '../src/lib/apis/apifootball';

describe('Global League Registry & Classification (Checkpoint B)', () => {
  // ─── 1. League Identity & Provider ID Preservation ────────────────────────
  describe('League Identity & Provider ID Preservation', () => {
    it('preserves exact canonical provider league_id and metadata', () => {
      const mockRaw: ApiFootballLeagueItem = {
        league: {
          id: 39,
          name: 'Premier League',
          type: 'League',
          logo: 'https://media.api-sports.io/football/leagues/39.png',
        },
        country: {
          name: 'England',
          code: 'GB',
          flag: 'https://media.api-sports.io/flags/gb.svg',
        },
        seasons: [
          {
            year: 2023,
            start: '2023-08-11',
            end: '2024-05-19',
            current: false,
            coverage: {
              fixtures: { events: true, lineups: true, statistics_fixtures: true },
              standings: true,
              odds: true,
            },
          },
          {
            year: 2024,
            start: '2024-08-16',
            end: '2025-05-25',
            current: true,
            coverage: {
              fixtures: { events: true, lineups: true, statistics_fixtures: true },
              standings: true,
              odds: true,
            },
          },
        ],
      };

      const classified = classifyLeague(mockRaw);

      expect(classified.league_id).toBe(39);
      expect(classified.name).toBe('Premier League');
      expect(classified.league_name).toBe('Premier League');
      expect(classified.provider).toBe('apifootball');
      expect(classified.provider_status).toBe('ACTIVE');
      expect(classified.type).toBe('league');
    });
  });

  // ─── 2. Country Mapping ───────────────────────────────────────────────────
  describe('Country Mapping', () => {
    it('correctly maps country name and ISO country code', () => {
      const mockRaw: ApiFootballLeagueItem = {
        league: { id: 140, name: 'La Liga', type: 'League' },
        country: { name: 'Spain', code: 'ES' },
        seasons: [{ year: 2024, current: true }],
      };

      const classified = classifyLeague(mockRaw);
      expect(classified.country).toBe('Spain');
      expect(classified.country_code).toBe('ES');
    });

    it('handles global or international competitions where country code is null', () => {
      const mockRaw: ApiFootballLeagueItem = {
        league: { id: 1, name: 'World Cup', type: 'Cup' },
        country: { name: 'World', code: null },
        seasons: [{ year: 2022, current: false }],
      };

      const classified = classifyLeague(mockRaw);
      expect(classified.country).toBe('World');
      expect(classified.country_code).toBeNull();
    });
  });

  // ─── 3. Season Mapping & Historical Depth ─────────────────────────────────
  describe('Season Mapping & Historical Depth', () => {
    it('identifies current season and sorts all available seasons', () => {
      const mockRaw: ApiFootballLeagueItem = {
        league: { id: 78, name: 'Bundesliga', type: 'League' },
        country: { name: 'Germany', code: 'DE' },
        seasons: [
          { year: 2021, current: false },
          { year: 2024, current: true },
          { year: 2022, current: false },
          { year: 2023, current: false },
        ],
      };

      const classified = classifyLeague(mockRaw);
      expect(classified.season).toBe(2024);
      expect(classified.seasons_available).toBe(4);
      expect(classified.all_seasons).toEqual([2021, 2022, 2023, 2024]);
    });

    it('correctly computes historical depth categories', () => {
      expect(calculateHistoricalDepth(0)).toBe('<1_SEASON');
      expect(calculateHistoricalDepth(1)).toBe('1_2_SEASONS');
      expect(calculateHistoricalDepth(2)).toBe('1_2_SEASONS');
      expect(calculateHistoricalDepth(3)).toBe('3_4_SEASONS');
      expect(calculateHistoricalDepth(4)).toBe('3_4_SEASONS');
      expect(calculateHistoricalDepth(5)).toBe('5_PLUS');
      expect(calculateHistoricalDepth(6)).toBe('5_PLUS');
      expect(calculateHistoricalDepth(7)).toBe('7_PLUS');
      expect(calculateHistoricalDepth(15)).toBe('7_PLUS');
      expect(calculateHistoricalDepth(-1)).toBe('UNKNOWN');
      expect(calculateHistoricalDepth(NaN)).toBe('UNKNOWN');
    });
  });

  // ─── 4. Dynamic Classification Tiers ──────────────────────────────────────
  describe('Dynamic Classification Tiers (Data-Driven, No Reputation Bias)', () => {
    it('classifies cup competitions as UNSUPPORTED regardless of depth', () => {
      const mockCup: ApiFootballLeagueItem = {
        league: { id: 45, name: 'FA Cup', type: 'Cup' },
        country: { name: 'England', code: 'GB' },
        seasons: Array.from({ length: 10 }, (_, i) => ({
          year: 2015 + i,
          current: i === 9,
          coverage: { fixtures: { events: true }, odds: true, standings: false },
        })),
      };

      const classified = classifyLeague(mockCup);
      expect(classified.tier).toBe('UNSUPPORTED');
      expect(classified.coverage_status).toBe('UNSUPPORTED');
    });

    it('classifies leagues with >= 7 seasons, odds, and full coverage as CORE', () => {
      const mockCore: ApiFootballLeagueItem = {
        league: { id: 39, name: 'Premier League', type: 'League' },
        country: { name: 'England', code: 'GB' },
        seasons: Array.from({ length: 8 }, (_, i) => ({
          year: 2017 + i,
          current: i === 7,
          coverage: {
            fixtures: { events: true, lineups: true, statistics_fixtures: true },
            standings: true,
            odds: true,
          },
        })),
      };

      const classified = classifyLeague(mockCore);
      expect(classified.tier).toBe('CORE');
      expect(classified.historical_depth).toBe('7_PLUS');
      expect(classified.coverage_status).toBe('FULL');
      expect(classified.odds_availability).toBe('PARTIAL');
    });

    it('classifies leagues with 5-6 seasons and odds as HIGH_VALUE', () => {
      const mockHighVal: ApiFootballLeagueItem = {
        league: { id: 999, name: 'Emerging League', type: 'League' },
        country: { name: 'Testland', code: 'TL' },
        seasons: Array.from({ length: 5 }, (_, i) => ({
          year: 2020 + i,
          current: i === 4,
          coverage: {
            fixtures: { events: true, statistics_fixtures: true },
            standings: true,
            odds: true,
          },
        })),
      };

      const classified = classifyLeague(mockHighVal);
      expect(classified.tier).toBe('HIGH_VALUE');
      expect(classified.historical_depth).toBe('5_PLUS');
    });

    it('classifies leagues without odds into LIMITED_DATA or RESEARCH based on depth', () => {
      const mockNoOdds: ApiFootballLeagueItem = {
        league: { id: 888, name: 'Amateur League', type: 'League' },
        country: { name: 'Nowhere', code: 'NW' },
        seasons: [{ year: 2024, current: true, coverage: { odds: false } }],
      };

      const classified = classifyLeague(mockNoOdds);
      expect(classified.tier).toBe('LIMITED_DATA');
      expect(classified.odds_availability).toBe('UNAVAILABLE');
    });
  });

  // ─── 5. Explicit Unknown State Handling ────────────────────────────────────
  describe('Explicit Unknown State Handling (Fail-Closed & No Fabrication)', () => {
    it('keeps fixture_count as UNKNOWN until actual fixture ingestion', () => {
      const mockRaw: ApiFootballLeagueItem = {
        league: { id: 135, name: 'Serie A', type: 'League' },
        country: { name: 'Italy', code: 'IT' },
        seasons: [{ year: 2024, current: true }],
      };

      const classified = classifyLeague(mockRaw);
      expect(classified.fixture_count).toBe('UNKNOWN');
    });

    it('leaves AH, OU, BTTS, ML markets as UNKNOWN when odds are only catalog-partial', () => {
      const mockRaw: ApiFootballLeagueItem = {
        league: { id: 61, name: 'Ligue 1', type: 'League' },
        country: { name: 'France', code: 'FR' },
        seasons: [{
          year: 2024,
          current: true,
          coverage: { fixtures: { events: true }, odds: true },
        }],
      };

      const classified = classifyLeague(mockRaw);
      // Catalog proves odds exist in general (PARTIAL), but specific market lines are UNKNOWN until line ingestion
      expect(classified.odds_availability).toBe('PARTIAL');
      expect(classified.market_availability.AH).toBe('UNKNOWN');
      expect(classified.market_availability.OU).toBe('UNKNOWN');
      expect(classified.market_availability.BTTS).toBe('UNKNOWN');
      expect(classified.market_availability.ML).toBe('UNKNOWN');
    });

    it('marks all sub-markets UNAVAILABLE if odds coverage is explicitly false', () => {
      const mockRaw: ApiFootballLeagueItem = {
        league: { id: 500, name: 'Youth League', type: 'League' },
        country: { name: 'CountryX', code: 'CX' },
        seasons: [{
          year: 2024,
          current: true,
          coverage: { odds: false },
        }],
      };

      const classified = classifyLeague(mockRaw);
      expect(classified.odds_availability).toBe('UNAVAILABLE');
      expect(classified.market_availability.AH).toBe('UNAVAILABLE');
      expect(classified.market_availability.OU).toBe('UNAVAILABLE');
      expect(classified.market_availability.BTTS).toBe('UNAVAILABLE');
      expect(classified.market_availability.ML).toBe('UNAVAILABLE');
    });
  });

  // ─── 6. Predictability Hooks ──────────────────────────────────────────────
  describe('Predictability Hooks', () => {
    it('initializes predictability hooks to null without fabricating scores', () => {
      const mockRaw: ApiFootballLeagueItem = {
        league: { id: 39, name: 'Premier League', type: 'League' },
        country: { name: 'England', code: 'GB' },
        seasons: [{ year: 2024, current: true }],
      };

      const classified = classifyLeague(mockRaw);
      expect(classified.predictability_hooks).toEqual({
        AH: null,
        OU: null,
        BTTS: null,
        ML: null,
      });
    });
  });

  // ─── 7. Coverage Matrix Structure ─────────────────────────────────────────
  describe('Coverage Matrix Generation', () => {
    it('generates machine-readable matrix matching all required canonical fields', () => {
      const mockLeagues: GlobalLeague[] = [
        classifyLeague({
          league: { id: 39, name: 'Premier League', type: 'League' },
          country: { name: 'England', code: 'GB' },
          seasons: [{ year: 2024, current: true, coverage: { odds: true, standings: true } }],
        }),
      ];

      const matrix = buildCoverageMatrix(mockLeagues);
      expect(matrix).toHaveLength(1);

      const item = matrix[0];
      expect(item).toHaveProperty('league', 'Premier League');
      expect(item).toHaveProperty('country', 'England');
      expect(item).toHaveProperty('league_id', 39);
      expect(item).toHaveProperty('seasons_available', 1);
      expect(item).toHaveProperty('historical_depth');
      expect(item).toHaveProperty('fixture_coverage');
      expect(item).toHaveProperty('AH_coverage', 'UNKNOWN');
      expect(item).toHaveProperty('OU_coverage', 'UNKNOWN');
      expect(item).toHaveProperty('BTTS_coverage', 'UNKNOWN');
      expect(item).toHaveProperty('ML_coverage', 'UNKNOWN');
      expect(item).toHaveProperty('odds_coverage', 'PARTIAL');
      expect(item).toHaveProperty('data_quality');
      expect(item).toHaveProperty('priority');
      expect(item).toHaveProperty('tier');
      expect(item).toHaveProperty('status');
    });
  });

  // ─── 8. Duplicate Detection ───────────────────────────────────────────────
  describe('Duplicate Detection', () => {
    it('detects duplicate league IDs in competition lists', () => {
      const leagues = [
        { league_id: 39, name: 'Premier League' },
        { league_id: 140, name: 'La Liga' },
        { league_id: 39, name: 'Premier League Duplicate' },
      ];

      const seen = new Set<number>();
      const duplicates: number[] = [];
      for (const l of leagues) {
        if (seen.has(l.league_id)) {
          duplicates.push(l.league_id);
        } else {
          seen.add(l.league_id);
        }
      }

      expect(duplicates).toEqual([39]);
    });
  });

  // ─── 9. Real-Data Zod Schema Integrity ────────────────────────────────────
  describe('Real-Data Zod Schema Integrity', () => {
    it('validates authentic API-Football /leagues response structure', () => {
      const realSample = {
        league: {
          id: 39,
          name: 'Premier League',
          type: 'League',
          logo: 'https://media.api-sports.io/football/leagues/39.png',
        },
        country: {
          name: 'England',
          code: 'GB',
          flag: 'https://media.api-sports.io/flags/gb.svg',
        },
        seasons: [
          {
            year: 2024,
            start: '2024-08-16',
            end: '2025-05-25',
            current: true,
            coverage: {
              fixtures: {
                events: true,
                lineups: true,
                statistics_fixtures: true,
                statistics_players: true,
              },
              standings: true,
              players: true,
              top_scorers: true,
              top_assists: true,
              top_cards: true,
              injuries: true,
              predictions: true,
              odds: true,
            },
          },
        ],
      };

      const parsed = ApiFootballLeagueItemSchema.safeParse(realSample);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.seasons?.[0].coverage?.odds).toBe(true);
        expect(parsed.data.seasons?.[0].coverage?.standings).toBe(true);
      }
    });
  });
});
