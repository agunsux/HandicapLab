import * as fs from 'fs';
import * as path from 'path';
import { FootyStatsResponseSchema, FootyStatsResponse, RawFootyStatsMatch } from './types';

export interface FetchSeasonResult {
  season: string;
  seasonId: number;
  fromCache: boolean;
  requestCount: number;
  cachePath: string;
  payload: FootyStatsResponse;
}

export class FootyStatsResearchClient {
  private readonly apiKey: string;
  private readonly cacheDir: string;
  private networkRequestsIssued = 0;
  private readonly maxPilotNetworkRequests: number;

  constructor(options?: {
    apiKey?: string;
    cacheDir?: string;
    maxPilotNetworkRequests?: number;
  }) {
    const rawKey = options?.apiKey ?? process.env.FOOTYSTATS_API_KEY;
    if (!rawKey || !rawKey.trim()) {
      throw new Error('[FOOTYSTATS_AUTH_ERROR] FOOTYSTATS_API_KEY is not configured in environment.');
    }
    this.apiKey = rawKey.trim();
    this.cacheDir = options?.cacheDir ?? path.resolve(process.cwd(), 'data/raw/footystats/epl');
    this.maxPilotNetworkRequests = options?.maxPilotNetworkRequests ?? 2;
  }

  public getNetworkRequestsIssued(): number {
    return this.networkRequestsIssued;
  }

  private redactKey(text: string): string {
    return text.split(this.apiKey).join('[REDACTED_KEY]');
  }

  public async getSeasonMatches(seasonId: number, seasonLabel: string): Promise<FetchSeasonResult> {
    const cacheFile = path.join(this.cacheDir, `${seasonLabel}.json`);

    // 1. Mandatory immutable disk cache check
    if (fs.existsSync(cacheFile)) {
      try {
        const cachedRaw = fs.readFileSync(cacheFile, 'utf-8');
        const parsedJson = JSON.parse(cachedRaw);
        const validated = FootyStatsResponseSchema.parse(parsedJson);
        return {
          season: seasonLabel,
          seasonId,
          fromCache: true,
          requestCount: 0,
          cachePath: cacheFile,
          payload: validated,
        };
      } catch (err: any) {
        throw new Error(
          `[FOOTYSTATS_CACHE_ERROR] Failed to read/parse existing cache file at ${cacheFile}: ${this.redactKey(err.message)}`
        );
      }
    }

    // 2. Enforce Pilot Network Request Ceiling (Fail-Closed)
    if (this.networkRequestsIssued >= this.maxPilotNetworkRequests) {
      throw new Error(
        `[PILOT_BUDGET_EXCEEDED] Network request ceiling reached (${this.networkRequestsIssued}/${this.maxPilotNetworkRequests}). Request for season ${seasonLabel} (${seasonId}) blocked.`
      );
    }

    // 3. Issue isolated HTTP GET request (0 automatic retries to prevent budget overshoot)
    const endpoint = `https://api.football-data-api.com/league-matches?key=${encodeURIComponent(this.apiKey)}&season_id=${seasonId}&max_per_page=500`;
    const sanitizedLogUrl = `https://api.football-data-api.com/league-matches?key=[REDACTED]&season_id=${seasonId}&max_per_page=500`;

    console.log(`[FootyStatsResearchClient] Fetching season ${seasonLabel} (ID: ${seasonId}) from ${sanitizedLogUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      this.networkRequestsIssued += 1;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HandicapLab-PrematchYield-Research/1.0',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const rawText = await response.text();
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (parseErr: any) {
        throw new Error(`Non-JSON response received from FootyStats: ${rawText.slice(0, 200)}`);
      }

      const validated = FootyStatsResponseSchema.safeParse(parsedJson);
      if (!validated.success) {
        throw new Error(`Schema validation failed on FootyStats response: ${validated.error.message}`);
      }

      if (!validated.data.success) {
        throw new Error(`FootyStats returned success=false: ${validated.data.message || 'Unknown provider error'}`);
      }

      // 4. Save raw response immutably to disk cache
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      fs.writeFileSync(cacheFile, JSON.stringify(validated.data, null, 2), 'utf-8');
      console.log(`[FootyStatsResearchClient] Saved ${validated.data.data.length} matches to immutable cache: ${cacheFile}`);

      return {
        season: seasonLabel,
        seasonId,
        fromCache: false,
        requestCount: 1,
        cachePath: cacheFile,
        payload: validated.data,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw new Error(`[FOOTYSTATS_FETCH_ERROR] ${this.redactKey(err.message || String(err))}`);
    }
  }
}

/**
 * Normalizes an odds value to a positive decimal number or null if missing/zero/unquoted.
 * Convention: 0, non-positive, or <= 1.0 indicates missing market quote.
 */
export function parseOddsValue(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num) || num <= 1.0) return null;
  return Math.round(num * 10000) / 10000;
}

