import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase.server';
import { apiFootballClient, type ApiFootballFixtureResponseItem } from '@/lib/apis/apifootball';
import { globalGateway, QuotaExhaustionError, ProviderUnavailableError } from '@/lib/providers/providerGateway';
import { normalizeTeamName } from '@/lib/identity/fixtureMapping';

export type CanonicalFixtureStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'LIVE'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'ABANDONED'
  | 'UNKNOWN';

export interface MarketOddsItem {
  available: boolean;
  line?: number | null;
  homeOdds?: number | null;
  awayOdds?: number | null;
  overOdds?: number | null;
  underOdds?: number | null;
  yesOdds?: number | null;
  noOdds?: number | null;
}

export interface CanonicalFixture {
  fixtureId: string;
  providerFixtureId: string;
  competitionId: number;
  competitionName: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string; // ISO 8601 UTC
  status: CanonicalFixtureStatus;
  source: 'api-football';
  firstSeenAt: string;
  lastSyncedAt: string;
  venue?: string;
  homeLogo?: string;
  awayLogo?: string;
  leagueLogo?: string;
  leagueCode?: string;
  leagueCountry?: string;
  hasPinnacleOdds?: boolean;
  markets: {
    asianHandicap: MarketOddsItem;
    overUnder: MarketOddsItem;
    btts: MarketOddsItem;
  };
}

export type FixtureDataState = 'REAL' | 'CACHED' | 'STALE' | 'DATA_UNAVAILABLE' | 'NO_FIXTURES';

export interface CanonicalFixtureRegistryResponse {
  fixtures: CanonicalFixture[];
  totalMatchesAvailable: number;
  generatedAt: string;
  lastSuccessfulSync: string | null;
  source: 'api-football';
  dataState: FixtureDataState;
  providerState: string;
  coverage: {
    leagues: number;
    fixtures: number;
  };
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes in-memory / disk cache
const CACHE_FILE_PATH = path.resolve('data/cache/canonical_fixtures.json');

// Default target leagues (Premier League: 39, Championship: 40, La Liga: 140, Serie A: 135, Bundesliga: 78)
export const DEFAULT_LEAGUE_COVERAGE = [39, 40, 140, 135, 78];

export class CanonicalFixtureRegistry {
  private static memoryCache: {
    data: CanonicalFixture[];
    lastSyncedAt: string;
    timestamp: number;
  } | null = null;

  /**
   * Deterministic canonical identity: competition:season:home:away:date
   */
  public static generateCanonicalFixtureId(
    competitionId: number,
    season: string,
    homeTeam: string,
    awayTeam: string,
    kickoffUtc: string
  ): string {
    const dateStr = kickoffUtc.slice(0, 10);
    const normHome = normalizeTeamName(homeTeam);
    const normAway = normalizeTeamName(awayTeam);
    const rawKey = `${competitionId}:${season}:${normHome}:${normAway}:${dateStr}`;
    return crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 16);
  }

  /**
   * Status Normalization: Map provider status short code into canonical state.
   */
  public static normalizeStatus(shortCode: string | null | undefined): CanonicalFixtureStatus {
    const code = (shortCode || '').toUpperCase().trim();
    switch (code) {
      case 'TBD':
      case 'NS':
        return 'SCHEDULED';
      case 'TIMED':
        return 'TIMED';
      case '1H':
      case 'HT':
      case '2H':
      case 'ET':
      case 'BT':
      case 'P':
      case 'INT':
      case 'LIVE':
        return 'LIVE';
      case 'FT':
      case 'AET':
      case 'PEN':
        return 'FINISHED';
      case 'PST':
      case 'POSTP':
        return 'POSTPONED';
      case 'CANC':
        return 'CANCELLED';
      case 'ABD':
        return 'ABANDONED';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Read persisted fixture registry from disk.
   */
  private static readDiskCache(): { fixtures: CanonicalFixture[]; lastSyncedAt: string } | null {
    try {
      if (fs.existsSync(CACHE_FILE_PATH)) {
        const stats = fs.statSync(CACHE_FILE_PATH);
        const ageMs = Date.now() - stats.mtimeMs;
        if (ageMs < 24 * 60 * 60 * 1000) { // Keep disk cache up to 24h as stale fallback
          const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
          const parsed = JSON.parse(raw);
          return {
            fixtures: parsed.fixtures || [],
            lastSyncedAt: parsed.lastSyncedAt || stats.mtime.toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn('[CanonicalFixtureRegistry] Disk cache read error:', e);
    }
    return null;
  }

  /**
   * Write fixtures to persistent disk cache.
   */
  private static writeDiskCache(fixtures: CanonicalFixture[], lastSyncedAt: string): void {
    try {
      const dir = path.dirname(CACHE_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        CACHE_FILE_PATH,
        JSON.stringify({ fixtures, lastSyncedAt, updatedAt: new Date().toISOString() }, null, 2),
        'utf-8'
      );
    } catch (e) {
      console.warn('[CanonicalFixtureRegistry] Disk cache write error:', e);
    }
  }

  /**
   * Synchronize upcoming fixtures from API-Football for the 7-day horizon.
   * Quota-safe, idempotent, and updates the canonical database and cache.
   */
  public static async syncUpcomingFixtures(options: {
    forceRefresh?: boolean;
    leagueIds?: number[];
  } = {}): Promise<{ fixtures: CanonicalFixture[]; dataState: FixtureDataState; providerState: string }> {
    const { forceRefresh = false, leagueIds = [39] } = options;
    const now = new Date();
    const nowUtc = now.toISOString();

    // Check in-memory freshness
    if (!forceRefresh && this.memoryCache && (Date.now() - this.memoryCache.timestamp < CACHE_TTL_MS)) {
      return {
        fixtures: this.memoryCache.data,
        dataState: 'CACHED',
        providerState: globalGateway.getHealthMonitor('apifootball').getState(),
      };
    }

    const providerMonitor = globalGateway.getHealthMonitor('apifootball');
    const providerState = providerMonitor.getState();

    // If provider is explicitly disabled or in active failure, serve cached/database fixtures
    if (providerState === 'DISABLED' || providerState === 'FAILED') {
      const disk = this.readDiskCache();
      if (disk && disk.fixtures.length > 0) {
        return {
          fixtures: disk.fixtures,
          dataState: 'STALE',
          providerState,
        };
      }
      return {
        fixtures: [],
        dataState: 'DATA_UNAVAILABLE',
        providerState,
      };
    }

    const from = nowUtc.slice(0, 10);
    const toDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const to = toDate.toISOString().slice(0, 10);

    const syncedFixtures: CanonicalFixture[] = [];

    try {
      for (const leagueId of leagueIds) {
        const season = now.getUTCFullYear();
        const envelope = await apiFootballClient.getFixturesRange(from, to, leagueId, season);
        const responseItems: ApiFootballFixtureResponseItem[] = envelope.response || [];

        for (const item of responseItems) {
          const rawStatus = item.fixture?.status?.short;
          const status = this.normalizeStatus(rawStatus);

          const fixtureDate = item.fixture?.date;
          if (!fixtureDate) continue;

          // Reject matches that kicked off in the past
          if (new Date(fixtureDate).getTime() <= now.getTime()) {
            continue;
          }

          const homeName = item.teams?.home?.name || 'Unknown Home';
          const awayName = item.teams?.away?.name || 'Unknown Away';
          const competitionName = item.league?.name || 'Premier League';
          const seasonStr = String(item.league?.season || season);

          const fixtureId = this.generateCanonicalFixtureId(
            leagueId,
            seasonStr,
            homeName,
            awayName,
            fixtureDate
          );

          syncedFixtures.push({
            fixtureId,
            providerFixtureId: String(item.fixture.id),
            competitionId: leagueId,
            competitionName,
            season: seasonStr,
            homeTeam: homeName,
            awayTeam: awayName,
            kickoffUtc: fixtureDate,
            status,
            source: 'api-football',
            firstSeenAt: nowUtc,
            lastSyncedAt: nowUtc,
            venue: item.fixture?.venue?.name ? `${item.fixture.venue.name}, ${item.fixture.venue.city || ''}`.trim() : undefined,
            homeLogo: item.teams?.home?.logo,
            awayLogo: item.teams?.away?.logo,
            leagueLogo: item.league?.logo,
            leagueCode: 'ENG-PL',
            leagueCountry: item.league?.country || 'England',
            markets: {
              asianHandicap: { available: false, line: null, homeOdds: null, awayOdds: null },
              overUnder: { available: false, line: null, overOdds: null, underOdds: null },
              btts: { available: false, line: null, yesOdds: null, noOdds: null },
            },
          });
        }
      }

      // Sort chronologically
      syncedFixtures.sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());

      // Idempotently upsert to Supabase `matches` table
      await this.upsertMatchesToDatabase(syncedFixtures);

      // Update in-memory & disk caches
      this.memoryCache = {
        data: syncedFixtures,
        lastSyncedAt: nowUtc,
        timestamp: Date.now(),
      };
      this.writeDiskCache(syncedFixtures, nowUtc);

      return {
        fixtures: syncedFixtures,
        dataState: syncedFixtures.length > 0 ? 'REAL' : 'NO_FIXTURES',
        providerState: 'ACTIVE',
      };
    } catch (err: any) {
      console.warn('[CanonicalFixtureRegistry] Sync warning, falling back to database/cache:', err.message);

      // Attempt to load from database first
      const dbFixtures = await this.loadUpcomingFromDatabase();
      if (dbFixtures.length > 0) {
        return {
          fixtures: dbFixtures,
          dataState: 'CACHED',
          providerState: globalGateway.getHealthMonitor('apifootball').getState(),
        };
      }

      // Fallback to disk cache
      const disk = this.readDiskCache();
      if (disk && disk.fixtures.length > 0) {
        return {
          fixtures: disk.fixtures.filter(f => new Date(f.kickoffUtc).getTime() > now.getTime()),
          dataState: 'STALE',
          providerState: globalGateway.getHealthMonitor('apifootball').getState(),
        };
      }

      const isQuota = err instanceof QuotaExhaustionError;
      const isUnavailable = err instanceof ProviderUnavailableError;
      const state: FixtureDataState = isQuota || isUnavailable ? 'DATA_UNAVAILABLE' : 'DATA_UNAVAILABLE';

      return {
        fixtures: [],
        dataState: state,
        providerState: globalGateway.getHealthMonitor('apifootball').getState(),
      };
    }
  }

  /**
   * Idempotently upsert canonical fixtures to Supabase `matches` table.
   * Never creates duplicate records.
   */
  public static async upsertMatchesToDatabase(fixtures: CanonicalFixture[]): Promise<void> {
    try {
      for (const f of fixtures) {
        const { data: existing } = await supabase
          .from('matches')
          .select('id')
          .eq('home_team', f.homeTeam)
          .eq('away_team', f.awayTeam)
          .eq('kickoff', f.kickoffUtc)
          .maybeSingle();

        if (existing?.id) {
          // Idempotent UPDATE
          await supabase
            .from('matches')
            .update({
              status: f.status === 'SCHEDULED' || f.status === 'TIMED' ? 'upcoming' : f.status.toLowerCase(),
              updated_at: new Date().toISOString(),
              pipeline_state: 'active',
            })
            .eq('id', existing.id);
        } else {
          // Idempotent INSERT
          await supabase
            .from('matches')
            .insert({
              home_team: f.homeTeam,
              away_team: f.awayTeam,
              league: f.competitionName,
              kickoff: f.kickoffUtc,
              status: f.status === 'SCHEDULED' || f.status === 'TIMED' ? 'upcoming' : f.status.toLowerCase(),
              source_type: 'api-football',
              data_status: 'REAL',
              pipeline_state: 'active',
            });
        }
      }
    } catch (e) {
      console.error('[CanonicalFixtureRegistry] Database upsert error:', e);
    }
  }

  /**
   * Read future fixtures directly from Supabase `matches` table.
   */
  public static async loadUpcomingFromDatabase(): Promise<CanonicalFixture[]> {
    try {
      const nowUtc = new Date().toISOString();
      const maxDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .gt('kickoff', nowUtc)
        .lte('kickoff', maxDate)
        .in('status', ['upcoming', 'scheduled'])
        .order('kickoff', { ascending: true })
        .limit(100);

      if (error || !data) return [];

      return data.map((m: any) => {
        const fixtureId = this.generateCanonicalFixtureId(
          39,
          '2026',
          m.home_team,
          m.away_team,
          m.kickoff
        );
        return {
          fixtureId,
          providerFixtureId: m.id,
          competitionId: 39,
          competitionName: m.league || 'Premier League',
          season: '2026',
          homeTeam: m.home_team,
          awayTeam: m.away_team,
          kickoffUtc: m.kickoff,
          status: 'SCHEDULED',
          source: 'api-football',
          firstSeenAt: m.created_at || nowUtc,
          lastSyncedAt: m.updated_at || nowUtc,
          markets: {
            asianHandicap: { available: false, line: null, homeOdds: null, awayOdds: null },
            overUnder: { available: false, line: null, overOdds: null, underOdds: null },
            btts: { available: false, line: null, yesOdds: null, noOdds: null },
          },
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Canonical Public Query: Returns upcoming fixtures within the 7-day horizon.
   * Only future scheduled/timed fixtures are eligible.
   */
  public static async getUpcomingFixtures(options: {
    horizon?: 'TODAY' | 'TOMORROW' | 'WEEKEND' | 'NEXT_7_DAYS';
    limit?: number;
    forceRefresh?: boolean;
  } = {}): Promise<CanonicalFixtureRegistryResponse> {
    const { horizon = 'NEXT_7_DAYS', limit = 50, forceRefresh = false } = options;

    const syncResult = await this.syncUpcomingFixtures({ forceRefresh });
    const now = new Date();
    const nowTime = now.getTime();
    const sevenDaysTime = nowTime + 7 * 24 * 60 * 60 * 1000;

    // Strict 7-day future horizon filter: kickoffUtc > nowUtc && kickoffUtc <= nowUtc + 7d
    let filtered = syncResult.fixtures.filter((f) => {
      const kTime = new Date(f.kickoffUtc).getTime();
      const isFuture = kTime > nowTime && kTime <= sevenDaysTime;
      const isPreMatch = f.status === 'SCHEDULED' || f.status === 'TIMED';
      return isFuture && isPreMatch;
    });

    // Sub-horizon filtering
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrowStr = new Date(nowTime + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    if (horizon === 'TODAY') {
      filtered = filtered.filter((f) => f.kickoffUtc.slice(0, 10) === todayStr);
    } else if (horizon === 'TOMORROW') {
      filtered = filtered.filter((f) => f.kickoffUtc.slice(0, 10) === tomorrowStr);
    } else if (horizon === 'WEEKEND') {
      filtered = filtered.filter((f) => {
        const day = new Date(f.kickoffUtc).getUTCDay();
        return day === 0 || day === 6; // Sunday = 0, Saturday = 6
      });
    }

    const sliced = filtered.slice(0, limit);
    const distinctLeagues = new Set(sliced.map((f) => f.competitionId)).size;

    return {
      fixtures: sliced,
      totalMatchesAvailable: filtered.length,
      generatedAt: now.toISOString(),
      lastSuccessfulSync: this.memoryCache?.lastSyncedAt || null,
      source: 'api-football',
      dataState: sliced.length > 0 ? syncResult.dataState : (syncResult.dataState === 'REAL' ? 'NO_FIXTURES' : syncResult.dataState),
      providerState: syncResult.providerState,
      coverage: {
        leagues: distinctLeagues,
        fixtures: sliced.length,
      },
    };
  }
}
