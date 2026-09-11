import * as fs from 'fs';
import * as path from 'path';

import { apiFootballClient, type ApiFootballFixtureResponseItem } from '@/lib/apis/apifootball';
import { QuotaExhaustionError } from '@/lib/providers/providerGateway';
import { type DataState } from '@/lib/data/dataState';

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

export interface PublicUpcomingFixture {
  id: number;
  leagueId: number;
  leagueCode: string;
  leagueName: string;
  leagueCountry: string;
  leagueLogo?: string;
  kickoff: string; // ISO 8601
  kickoffDate: string; // YYYY-MM-DD
  kickoffTime: string; // HH:mm UTC
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  venue?: string;
  status: string;
  markets: {
    asianHandicap: MarketOddsItem;
    overUnder: MarketOddsItem;
    btts: MarketOddsItem;
  };
}

export interface UpcomingFixturesResult {
  fixtures: PublicUpcomingFixture[];
  totalMatchesAvailable?: number;
  generatedAt: string;
  source: 'api-football';
  dataState: DataState;
  coverage: {
    leagues: number;
    fixtures: number;
  };
}

interface TargetLeagueMeta {
  id: number;
  code: string;
  name: string;
  country: string;
  region: string;
  tier: number;
  priority: string;
}

// In-memory cache for serverless environments
let memoryCachedResult: { data: UpcomingFixturesResult; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

function getTargetLeaguesMap(): Map<number, TargetLeagueMeta> {
  const map = new Map<number, TargetLeagueMeta>();
  try {
    const registryPath = path.resolve('src/historical/research/epic66_league_registry.json');
    if (fs.existsSync(registryPath)) {
      const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      for (const lg of raw.leagues || []) {
        map.set(lg.id, lg);
      }
    }
  } catch (err) {
    console.warn('[UpcomingFixturesService] Error reading league registry:', err);
  }
  return map;
}

// No market is advertised as available unless real odds are attached.
function unavailableMarket(): MarketOddsItem {
  return { available: false, line: null, homeOdds: null, awayOdds: null };
}

export class UpcomingFixturesService {
  private static getCacheFilePath(): string {
    return path.resolve('data/cache/upcoming_fixtures.json');
  }

  private static readDiskCache(maxAgeMs = CACHE_TTL_MS): UpcomingFixturesResult | null {
    try {
      const cacheFile = this.getCacheFilePath();
      if (fs.existsSync(cacheFile)) {
        const stats = fs.statSync(cacheFile);
        const ageMs = Date.now() - stats.mtimeMs;
        if (ageMs < maxAgeMs) {
          const raw = fs.readFileSync(cacheFile, 'utf-8');
          return JSON.parse(raw);
        }
      }
    } catch (e) {
      console.warn('[UpcomingFixturesService] Cache read error:', e);
    }
    return null;
  }

  private static writeDiskCache(data: UpcomingFixturesResult): void {
    try {
      const cacheFile = this.getCacheFilePath();
      const dir = path.dirname(cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[UpcomingFixturesService] Cache write error:', e);
    }
  }

  /**
   * Fetch upcoming fixtures for the specified date window (up to 7 days ahead).
   *
   * Quota-safe: all provider access goes through the canonical API-Football
   * client (ProviderGateway + QuotaManager), a single date-range request is
   * used, and fresh cache is served before any provider call.
   */
  public static async getUpcomingFixtures(options: {
    daysAhead?: number; // 1 to 7 days
    forceRefresh?: boolean;
    leagueCode?: string;
    limit?: number;
  } = {}): Promise<UpcomingFixturesResult> {
    const { daysAhead = 7, forceRefresh = false, leagueCode, limit } = options;

    // Check memory cache first
    if (!forceRefresh && memoryCachedResult && Date.now() - memoryCachedResult.timestamp < CACHE_TTL_MS) {
      return this.filterResult(
        { ...memoryCachedResult.data, dataState: 'CACHED' },
        daysAhead,
        leagueCode,
        limit
      );
    }

    // Check disk cache
    if (!forceRefresh) {
      const diskCached = this.readDiskCache();
      if (diskCached) {
        memoryCachedResult = { data: diskCached, timestamp: Date.now() };
        return this.filterResult({ ...diskCached, dataState: 'CACHED' }, daysAhead, leagueCode, limit);
      }
    }

    const now = new Date();
    const from = now.toISOString().slice(0, 10);
    const toDate = new Date(now.getTime() + (Math.min(daysAhead, 7) - 1) * 24 * 60 * 60 * 1000);
    const to = toDate.toISOString().slice(0, 10);

    let responseItems: ApiFootballFixtureResponseItem[] = [];
    try {
      const envelope = await apiFootballClient.getFixturesRange(from, to);
      responseItems = envelope.response;
    } catch (err) {
      const quotaPaused = err instanceof QuotaExhaustionError;
      const state: DataState = quotaPaused ? 'DATA_UPDATE_PAUSED' : 'DATA_UNAVAILABLE';

      // Serve the latest valid cached snapshot (marked stale) instead of fake data.
      const staleDisk = this.readDiskCache(30 * 24 * 60 * 60 * 1000);
      if (staleDisk) {
        return this.filterResult(
          { ...staleDisk, dataState: quotaPaused ? 'DATA_UPDATE_PAUSED' : 'STALE' },
          daysAhead,
          leagueCode,
          limit
        );
      }

      console.warn(
        `[UpcomingFixturesService] Provider fetch unavailable (${state}):`,
        err instanceof Error ? err.message : err
      );
      return {
        fixtures: [],
        generatedAt: new Date().toISOString(),
        source: 'api-football',
        dataState: state,
        coverage: { leagues: 0, fixtures: 0 },
      };
    }

    const targetLeagues = getTargetLeaguesMap();
    const allFixtures: PublicUpcomingFixture[] = [];

    for (const item of responseItems) {
      const leagueId = item.league?.id;
      const targetMeta = targetLeagues.get(leagueId);
      // Only keep fixtures from our target leagues
      if (!targetMeta) continue;

      const status = item.fixture?.status?.short || 'NS';
      // Skip matches that are already finished
      if (['FT', 'AET', 'PEN', 'CANC', 'ABD', 'POSTP'].includes(status)) continue;

      const fixtureDate = item.fixture?.date || '';
      const kickoffDate = fixtureDate.slice(0, 10);
      const kickoffTime = fixtureDate.slice(11, 16);

      allFixtures.push({
        id: item.fixture.id,
        leagueId,
        leagueCode: targetMeta.code,
        leagueName: targetMeta.name,
        leagueCountry: targetMeta.country,
        leagueLogo: item.league?.logo,
        kickoff: fixtureDate,
        kickoffDate,
        kickoffTime,
        homeTeam: item.teams?.home?.name || '',
        awayTeam: item.teams?.away?.name || '',
        homeLogo: item.teams?.home?.logo,
        awayLogo: item.teams?.away?.logo,
        venue: item.fixture?.venue?.name
          ? `${item.fixture.venue.name}, ${item.fixture.venue.city || ''}`.trim()
          : undefined,
        status,
        markets: {
          asianHandicap: unavailableMarket(),
          overUnder: unavailableMarket(),
          btts: { available: false, line: null, yesOdds: null, noOdds: null },
        },
      });
    }

    // Sort chronologically by kickoff timestamp
    allFixtures.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

    const distinctLeagues = new Set(allFixtures.map((f) => f.leagueId)).size;
    const fullResult: UpcomingFixturesResult = {
      fixtures: allFixtures,
      generatedAt: new Date().toISOString(),
      source: 'api-football',
      dataState: 'REAL',
      coverage: {
        leagues: distinctLeagues,
        fixtures: allFixtures.length
      }
    };

    // Save to cache
    this.writeDiskCache(fullResult);
    memoryCachedResult = { data: fullResult, timestamp: Date.now() };

    return this.filterResult(fullResult, daysAhead, leagueCode, limit);
  }

  private static filterResult(
    result: UpcomingFixturesResult,
    daysAhead: number,
    leagueCode?: string,
    limit?: number
  ): UpcomingFixturesResult {
    const now = new Date();
    const cutoffTime = now.getTime() + daysAhead * 24 * 60 * 60 * 1000;

    let filtered = result.fixtures.filter((f) => {
      const matchTime = new Date(f.kickoff).getTime();
      return matchTime >= now.getTime() - 2 * 60 * 60 * 1000 && matchTime <= cutoffTime;
    });

    if (leagueCode) {
      filtered = filtered.filter((f) => f.leagueCode.toLowerCase() === leagueCode.toLowerCase());
    }

    const totalAvailable = filtered.length;
    const finalFixtures = limit ? filtered.slice(0, limit) : filtered;
    const distinctLeagues = new Set(finalFixtures.map((f) => f.leagueId)).size;

    return {
      fixtures: finalFixtures,
      totalMatchesAvailable: totalAvailable,
      generatedAt: result.generatedAt,
      source: result.source,
      dataState: result.dataState,
      coverage: {
        leagues: distinctLeagues,
        fixtures: finalFixtures.length
      }
    };
  }
}
