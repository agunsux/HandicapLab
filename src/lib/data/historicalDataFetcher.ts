import { apiFootballClient } from '../api/apiFootball';
import { transformFixtureData, TransformedMatch } from './dataTransformer';
import { rateLimiter } from '../api/rateLimiter';
import * as fs from 'fs';
import * as path from 'path';

export interface FetcherProgress {
  leaguesProcessed: number;
  fixturesFetched: number;
  statsFetched: number;
  cacheHits: number;
  apiRequests: number;
}

export class HistoricalDataFetcher {
  private leagues = [39, 140, 135]; // Premier League, La Liga, Serie A
  private seasons = [2022, 2023, 2024];
  private matchesFile: string;

  constructor() {
    this.matchesFile = path.join(process.cwd(), 'cache', 'api-football', 'transformed_matches.json');
  }

  private ensureDirectoryExists(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadStoredMatches(): Record<string, TransformedMatch> {
    if (!fs.existsSync(this.matchesFile)) {
      return {};
    }
    try {
      const content = fs.readFileSync(this.matchesFile, 'utf-8');
      return JSON.parse(content) as Record<string, TransformedMatch>;
    } catch (e) {
      console.warn('Failed to parse transformed_matches.json, returning empty object:', e);
      return {};
    }
  }

  private saveStoredMatches(matches: Record<string, TransformedMatch>) {
    this.ensureDirectoryExists(this.matchesFile);
    fs.writeFileSync(this.matchesFile, JSON.stringify(matches, null, 2), 'utf-8');
  }

  /**
   * Run the historical data fetcher process.
   * Fetches fixtures and stats as long as the rate limiter allows.
   */
  public async fetchAll(maxNewRequests = 90): Promise<FetcherProgress> {
    console.log(`[HistoricalDataFetcher] Starting fetch process. Max new requests allowed this session: ${maxNewRequests}`);
    const progress: FetcherProgress = {
      leaguesProcessed: 0,
      fixturesFetched: 0,
      statsFetched: 0,
      cacheHits: 0,
      apiRequests: 0,
    };

    const storedMatches = this.loadStoredMatches();
    const initialRequestCount = rateLimiter.getTodayRequestCount();

    try {
      for (const league of this.leagues) {
        for (const season of this.seasons) {
          console.log(`\n--- Processing League: ${league}, Season: ${season} ---`);
          
          // 1. Fetch fixtures list (usually cached after the first fetch)
          const fixtures = await apiFootballClient.getFixtures(league, season);
          progress.fixturesFetched += fixtures.length;
          
          // Filter to finished matches
          const completedFixtures = fixtures.filter(
            (f: any) => f.fixture.status.short === 'FT' && f.score.halftime.home !== null
          );
          
          console.log(`Found ${completedFixtures.length} completed fixtures in ${league} for season ${season}`);

          for (const f of completedFixtures) {
            const fixtureId = f.fixture.id;
            
            // Check if we already transformed and stored this match
            if (storedMatches[fixtureId]) {
              progress.cacheHits++;
              continue;
            }

            // Check if we will exceed the safety limit of new requests for this run
            const currentRequests = rateLimiter.getTodayRequestCount() - initialRequestCount;
            if (currentRequests >= maxNewRequests) {
              console.warn(`[HistoricalDataFetcher] Session request limit reached (${maxNewRequests}). Pausing fetch.`);
              return progress;
            }

            try {
              // 2. Fetch statistics for this fixture
              const stats = await apiFootballClient.getFixtureStatistics(fixtureId);
              progress.statsFetched++;

              const homeStats = stats.find((s: any) => s.team.id === f.teams.home.id)?.statistics;
              const awayStats = stats.find((s: any) => s.team.id === f.teams.away.id)?.statistics;

              // 3. Optional: Fetch team statistics (per guidance instructions)
              // To respect the fetch order and make sure the endpoint is verified:
              await apiFootballClient.getTeamStatistics(league, season, f.teams.home.id);
              await apiFootballClient.getTeamStatistics(league, season, f.teams.away.id);

              // 4. Transform and store the match
              const transformed = transformFixtureData(f, homeStats, awayStats);
              storedMatches[fixtureId] = transformed;
              
              // Save incrementally to prevent data loss on crash/limit
              this.saveStoredMatches(storedMatches);

            } catch (err: any) {
              if (err.message && err.message.includes('Rate Limit Reached')) {
                console.warn('[HistoricalDataFetcher] Daily rate limit reached. Exiting gracefully.');
                return progress;
              }
              console.error(`[HistoricalDataFetcher] Error fetching stats for fixture ${fixtureId}:`, err);
            }
          }
          progress.leaguesProcessed++;
        }
      }
    } catch (e: any) {
      console.error('[HistoricalDataFetcher] Unexpected error in fetch queue:', e);
    }

    const finalRequests = rateLimiter.getTodayRequestCount() - initialRequestCount;
    progress.apiRequests = finalRequests;
    console.log(`\n[HistoricalDataFetcher] Run Completed. Total stored matches in ledger: ${Object.keys(storedMatches).length}`);
    return progress;
  }
}

export const historicalDataFetcher = new HistoricalDataFetcher();
