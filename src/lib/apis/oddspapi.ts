import { z } from 'zod';

// Ensure this module is only imported/run on the server side
if (typeof window !== 'undefined') {
  throw new Error('Odds API client can only be used on the server side.');
}

/**
 * Custom error class for API failures
 */
export class ApiError extends Error {
  public status?: number;
  public endpoint: string;
  public details?: any;

  constructor(message: string, endpoint: string, status?: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.endpoint = endpoint;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Zod Schemas for validating The Odds API responses

export const OddsApiSportSchema = z.object({
  key: z.string(),
  active: z.boolean(),
  group: z.string(),
  description: z.string(),
  title: z.string(),
  has_outrights: z.boolean(),
});

export const OddsApiOutcomeSchema = z.object({
  name: z.string(),
  price: z.number(),
  point: z.number().optional(),
});

export const OddsApiMarketSchema = z.object({
  key: z.string(),
  last_update: z.string().optional(),
  outcomes: z.array(OddsApiOutcomeSchema),
});

export const OddsApiBookmakerSchema = z.object({
  key: z.string(),
  title: z.string(),
  last_update: z.string().optional(),
  markets: z.array(OddsApiMarketSchema),
});

export const OddsApiMatchOddsSchema = z.object({
  id: z.string(),
  sport_key: z.string(),
  sport_title: z.string(),
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(OddsApiBookmakerSchema),
});

export type OddsApiSport = z.infer<typeof OddsApiSportSchema>;
export type OddsApiMatchOdds = z.infer<typeof OddsApiMatchOddsSchema>;

interface FetchOptions {
  timeoutMs?: number;
}

export class OddsApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    const key = process.env.ODDSPAPI_KEY;
    if (!key) {
      // In production/runtime, lack of key is fatal for live operations.
      // We do not fallback to hardcoded keys.
      this.apiKey = '';
    } else {
      this.apiKey = key;
    }

    // Rely on environment variable for base URL or fallback to standard API endpoint
    this.baseUrl = process.env.ODDSPAPI_BASE_URL || 'https://api.the-odds-api.com';
  }

  private ensureApiKey(): void {
    if (!this.apiKey) {
      console.error('[OddsApiClient] Error: ODDSPAPI_KEY environment variable is not defined.');
      throw new ApiError('API key is missing in environment variables.', 'auth', 401);
    }
  }

  /**
   * Performs the HTTP request with timeout, safe JSON parsing, and custom error handling
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string> = {},
    schema: z.ZodSchema<T>,
    options: FetchOptions = {}
  ): Promise<T> {
    this.ensureApiKey();

    const { timeoutMs = 10000 } = options;
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add parameters and API key
    url.searchParams.append('apiKey', this.apiKey);
    Object.entries(params).forEach(([key, val]) => {
      url.searchParams.append(key, val);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();
    console.log(`[OddsApiClient] Initiating request to endpoint: ${endpoint}`);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      console.log(`[OddsApiClient] Request completed in ${duration}ms with status ${response.status}`);

      let responseText: string;
      try {
        responseText = await response.text();
      } catch (err: any) {
        throw new ApiError(
          `Failed to read response body: ${err.message}`,
          endpoint,
          response.status
        );
      }

      // Safe JSON parsing
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch (err: any) {
        console.error(`[OddsApiClient] Safe JSON parse failed for ${endpoint}. Raw: ${responseText.substring(0, 200)}`);
        throw new ApiError(
          `Invalid JSON response: ${err.message}`,
          endpoint,
          response.status
        );
      }

      if (!response.ok) {
        console.error(`[OddsApiClient] API returned error status: ${response.status}`, responseData);
        throw new ApiError(
          responseData?.message || `API error with status ${response.status}`,
          endpoint,
          response.status,
          responseData
        );
      }

      // Schema validation with Zod
      const validationResult = schema.safeParse(responseData);
      if (!validationResult.success) {
        console.error(
          `[OddsApiClient] Zod validation failed for endpoint ${endpoint}:`,
          validationResult.error.format()
        );
        throw new ApiError(
          `Response validation failed: ${validationResult.error.message}`,
          endpoint,
          response.status,
          validationResult.error.format()
        );
      }

      return validationResult.data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        console.error(`[OddsApiClient] Request to ${endpoint} timed out after ${timeoutMs}ms.`);
        throw new ApiError(`Request timed out after ${timeoutMs}ms`, endpoint, 408);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      console.error(`[OddsApiClient] Request to ${endpoint} failed with error:`, error);
      throw new ApiError(error.message || 'Unknown network error', endpoint, 500, error);
    }
  }

  /**
   * Fetch active sports lists
   */
  public async getSports(options?: FetchOptions): Promise<OddsApiSport[]> {
    return this.request<OddsApiSport[]>(
      '/v4/sports',
      {},
      z.array(OddsApiSportSchema),
      options
    );
  }

  /**
   * Fetch live and upcoming odds for a given sport, region, and markets
   */
  public async getOdds(
    sport: string,
    regions = 'eu',
    markets = 'h2h,spreads,totals',
    oddsFormat = 'decimal',
    options?: FetchOptions
  ): Promise<OddsApiMatchOdds[]> {
    const params = {
      regions,
      markets,
      oddsFormat,
    };
    return this.request<OddsApiMatchOdds[]>(
      `/v4/sports/${sport}/odds`,
      params,
      z.array(OddsApiMatchOddsSchema),
      options
    );
  }
}

export const oddsApiClient = new OddsApiClient();
