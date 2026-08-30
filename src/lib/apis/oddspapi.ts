import { ApiError } from './apifootball';

export interface OddsPapiMarket {
  key: string;
  outcomes: Array<{
    name: string;
    price: number;
    point?: number;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface OddsPapiBookmaker {
  key: string;
  title?: string;
  last_update?: string;
  markets: OddsPapiMarket[];
  [key: string]: any;
}

export interface OddsPapiEvent {
  id?: string;
  sport_key?: string;
  sport_title?: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: OddsPapiBookmaker[];
  [key: string]: any;
}

export interface OddsOptions {
  regions?: string;
  markets?: string;
  oddsFormat?: string;
}

export class OddsApiClient {
  private baseUrl: string;
  private apiKey: string;
  private lastRequestTime: number = 0;
  private rateLimitDelayMs: number = 2000;

  constructor() {
    this.apiKey = (process.env.ODDS_PAPI_KEY || '').replace(/['`"]/g, '').trim();
    this.baseUrl = process.env.ODDSPAPI_BASE_URL || 'https://api.oddspapi.io';
  }

  private ensureApiKey(): void {
    if (!this.apiKey) {
      this.apiKey = (process.env.ODDS_PAPI_KEY || '').replace(/['`"]/g, '').trim();
    }
    if (!this.apiKey) {
      throw new ApiError('OddsPapi API key is missing in environment variables.', 'auth', 401);
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  async getOdds(
    sportKey: string,
    regionsOrOptions?: string | OddsOptions,
    marketsParam?: string,
    oddsFormatParam?: string
  ): Promise<OddsPapiEvent[]> {
    this.ensureApiKey();
    await this.enforceRateLimit();

    let regions = 'eu,uk';
    let markets = 'spreads';
    let oddsFormat = 'decimal';

    if (typeof regionsOrOptions === 'string') {
      regions = regionsOrOptions;
      if (marketsParam) markets = marketsParam;
      if (oddsFormatParam) oddsFormat = oddsFormatParam;
    } else if (typeof regionsOrOptions === 'object' && regionsOrOptions !== null) {
      if (regionsOrOptions.regions) regions = regionsOrOptions.regions;
      if (regionsOrOptions.markets) markets = regionsOrOptions.markets;
      if (regionsOrOptions.oddsFormat) oddsFormat = regionsOrOptions.oddsFormat;
    }

    const urlVariants = [
      `${this.baseUrl}/v1/odds?apiKey=${this.apiKey}&sport=${sportKey}&regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}`,
      `${this.baseUrl}/v1/sports/${sportKey}/odds?apiKey=${this.apiKey}&regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}`,
      `${this.baseUrl}/api/v1/odds?apiKey=${this.apiKey}&sport_key=${sportKey}&markets=${markets}`,
    ];

    for (const url of urlVariants) {
      try {
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (response.ok) {
          const json = await response.json();
          if (Array.isArray(json)) return json;
          if (json && Array.isArray(json.data)) return json.data;
        } else if (response.status === 401) {
          throw new ApiError('OddsPapi authentication failed (401). Check ODDS_PAPI_KEY.', 'auth', 401);
        }
      } catch (err: any) {
        if (err.statusCode === 401) throw err;
      }
    }

    return [];
  }
}

export const oddsApiClient = new OddsApiClient();
