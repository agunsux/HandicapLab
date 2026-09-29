import { SecretScrubber } from './scrubber';
import { ProbeResponseMetadata } from './fiveDollarProbe';

export class DribbleProviderProbe {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;

  constructor() {
    SecretScrubber.initialize();
    this.baseUrl = 'https://dribble360.com/api/v1';
    this.apiKey = process.env.DRIBBLE_API_KEY?.trim() || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  public async request(endpoint: string, queryParams?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    if (!this.apiKey) {
      return {
        url: `${this.baseUrl}${endpoint}`,
        httpStatus: 401,
        statusText: 'UNCONFIGURED',
        latencyMs: 0,
        headers: {},
        error: 'DRIBBLE_API_KEY is not set in environment',
        data: null,
      };
    }

    let url = `${this.baseUrl}${endpoint}`;
    if (queryParams && Object.keys(queryParams).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(queryParams)) {
        if (v !== undefined && v !== null) {
          searchParams.append(k, String(v));
        }
      }
      url += `?${searchParams.toString()}`;
    }

    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'HandicapLab-BakeOff/1.0',
        },
      });
      const latencyMs = Date.now() - start;

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        responseHeaders[key.toLowerCase()] = val;
      });

      let responseBody: any = null;
      const text = await res.text();
      try {
        responseBody = JSON.parse(text);
      } catch {
        responseBody = text;
      }

      const sanitizedUrl = SecretScrubber.scrubText(url);
      const sanitizedData = SecretScrubber.scrubObject(responseBody);

      return {
        url: sanitizedUrl,
        httpStatus: res.status,
        statusText: res.statusText,
        latencyMs,
        headers: responseHeaders,
        rateLimitLimit: responseHeaders['x-ratelimit-limit'],
        rateLimitRemaining: responseHeaders['x-ratelimit-remaining'],
        rateLimitReset: responseHeaders['x-ratelimit-reset'],
        error: !res.ok ? (responseBody?.error || responseBody?.message || res.statusText) : undefined,
        data: sanitizedData,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        url: SecretScrubber.scrubText(url),
        httpStatus: 0,
        statusText: 'NETWORK_ERROR',
        latencyMs,
        headers: {},
        error: err?.message || String(err),
        data: null,
      };
    }
  }

  public async getMatches(params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request('/matches', params);
  }

  public async getTeams(params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request('/teams', params);
  }

  public async getPlayers(params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request('/players', params);
  }

  public async getPlayerMatches(params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request('/player_matches', params);
  }

  public async getTeamMatches(params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request('/team_matches', params);
  }

  public async getManagers(params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request('/managers', params);
  }

  public async getReferees(params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request('/referees', params);
  }

  public async getTransfers(params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request('/transfers', params);
  }

  public async getSeasons(params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request('/seasons', params);
  }

  public async getLeagues(params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request('/leagues', params);
  }

  public async testOddsEndpoints(): Promise<Record<string, ProbeResponseMetadata>> {
    const results: Record<string, ProbeResponseMetadata> = {};
    const testPaths = ['/odds', '/fixtures/odds', '/bookmakers', '/markets', '/closing-odds'];
    for (const p of testPaths) {
      results[p] = await this.request(p);
    }
    return results;
  }
}
