import { SecretScrubber } from './scrubber';

export interface ProbeResponseMetadata {
  url: string;
  httpStatus: number;
  statusText: string;
  latencyMs: number;
  headers: Record<string, string>;
  rateLimitLimit?: string;
  rateLimitRemaining?: string;
  rateLimitReset?: string;
  error?: string;
  data: any;
}

export class FiveDollarFootballApiProbe {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;

  constructor() {
    SecretScrubber.initialize();
    this.baseUrl = 'https://api.5dollarfootballapi.com/v1';
    this.apiKey = process.env.FIVE_DOLLAR_API_KEY?.trim() || null;
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
        error: 'FIVE_DOLLAR_API_KEY is not set in environment',
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
          'X-API-Key': this.apiKey,
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
        error: !res.ok ? (responseBody?.error?.message || responseBody?.error || responseBody?.message || res.statusText) : undefined,
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

  public async getStatus(): Promise<ProbeResponseMetadata> {
    return this.request('/status');
  }

  public async getBookmakers(): Promise<ProbeResponseMetadata> {
    return this.request('/bookmakers');
  }

  public async getLeagues(): Promise<ProbeResponseMetadata> {
    return this.request('/leagues');
  }

  public async getLeagueDetail(id: number | string): Promise<ProbeResponseMetadata> {
    return this.request(`/leagues/${id}`);
  }

  public async getLeagueFixtures(id: number | string, params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request(`/leagues/${id}/fixtures`, params);
  }

  public async getFixtures(params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request('/fixtures', params);
  }

  public async getFixture(id: number | string): Promise<ProbeResponseMetadata> {
    return this.request(`/fixtures/${id}`);
  }

  public async getFixtureOdds(id: number | string, params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request(`/fixtures/${id}/odds`, params);
  }

  public async getFixtureOddsHistory(id: number | string, params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request(`/fixtures/${id}/odds/history`, params);
  }

  public async getFixtureStatistics(id: number | string): Promise<ProbeResponseMetadata> {
    return this.request(`/fixtures/${id}/statistics`);
  }

  public async getFixtureEvents(id: number | string): Promise<ProbeResponseMetadata> {
    return this.request(`/fixtures/${id}/events`);
  }

  public async getTeam(id: number | string): Promise<ProbeResponseMetadata> {
    return this.request(`/teams/${id}`);
  }

  public async getTeamFixtures(id: number | string, params?: Record<string, string | number>): Promise<ProbeResponseMetadata> {
    return this.request(`/teams/${id}/fixtures`, params);
  }
}
