import * as fs from 'fs';
import * as path from 'path';

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

export class UpcomingFixturesService {
  private static getCacheFilePath(): string {
    return path.resolve('data/cache/upcoming_fixtures.json');
  }

  private static readDiskCache(): UpcomingFixturesResult | null {
    try {
      const cacheFile = this.getCacheFilePath();
      if (fs.existsSync(cacheFile)) {
        const stats = fs.statSync(cacheFile);
        const ageMs = Date.now() - stats.mtimeMs;
        if (ageMs < CACHE_TTL_MS) {
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
   * Fetch upcoming fixtures for the specified date window (up to 7 days ahead)
   * Quota-safe: Uses cached results if fresh (< 1 hour old).
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
      return this.filterResult(memoryCachedResult.data, daysAhead, leagueCode, limit);
    }

    // Check disk cache
    if (!forceRefresh) {
      const diskCached = this.readDiskCache();
      if (diskCached) {
        memoryCachedResult = { data: diskCached, timestamp: Date.now() };
        return this.filterResult(diskCached, daysAhead, leagueCode, limit);
      }
    }

    // Query API-Football
    const apiKey = (process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '').trim().replace(/['"]/g, '');
    if (!apiKey) {
      console.warn('[UpcomingFixturesService] API-Football key missing.');
      // If disk cache exists even if expired, return it gracefully
      const staleDisk = this.readDiskCache();
      if (staleDisk) return this.filterResult(staleDisk, daysAhead, leagueCode);
      return {
        fixtures: [],
        generatedAt: new Date().toISOString(),
        source: 'api-football',
        coverage: { leagues: 0, fixtures: 0 }
      };
    }

    const targetLeagues = getTargetLeaguesMap();
    const allFixtures: PublicUpcomingFixture[] = [];
    const now = new Date();

    // Fetch dates (today + up to 6 days ahead)
    const datesToFetch: string[] = [];
    for (let i = 0; i < Math.min(daysAhead, 7); i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      datesToFetch.push(d.toISOString().slice(0, 10));
    }

    for (const dateStr of datesToFetch) {
      try {
        const url = `https://v3.football.api-sports.io/fixtures?date=${dateStr}`;
        const res = await fetch(url, {
          headers: {
            'x-apisports-key': apiKey,
            Accept: 'application/json'
          },
          next: { revalidate: 3600 }
        });

        if (!res.ok) {
          console.warn(`[UpcomingFixturesService] Failed for date ${dateStr}: HTTP ${res.status}`);
          continue;
        }

        const json = await res.json();
        const items = json?.response;
        if (Array.isArray(items)) {
          for (const item of items) {
            const leagueId = item.league?.id;
            const targetMeta = targetLeagues.get(leagueId);
            // Only keep fixtures from our 30 target leagues
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
              homeTeam: item.teams?.home?.name || 'Home',
              awayTeam: item.teams?.away?.name || 'Away',
              homeLogo: item.teams?.home?.logo,
              awayLogo: item.teams?.away?.logo,
              venue: item.fixture?.venue?.name ? `${item.fixture.venue.name}, ${item.fixture.venue.city || ''}`.trim() : undefined,
              status,
              markets: {
                asianHandicap: { available: true, line: null, homeOdds: null, awayOdds: null },
                overUnder: { available: true, line: null, overOdds: null, underOdds: null },
                btts: { available: true, yesOdds: null, noOdds: null }
              }
            });
          }
        }
      } catch (err) {
        console.error(`[UpcomingFixturesService] Error fetching date ${dateStr}:`, err);
      }
    }

    // Sort chronologically by kickoff timestamp
    allFixtures.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

    const distinctLeagues = new Set(allFixtures.map((f) => f.leagueId)).size;
    const fullResult: UpcomingFixturesResult = {
      fixtures: allFixtures,
      generatedAt: new Date().toISOString(),
      source: 'api-football',
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
      coverage: {
        leagues: distinctLeagues,
        fixtures: finalFixtures.length
      }
    };
  }
}
