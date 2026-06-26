import { z } from 'zod';

// Ensure this module is only imported/run on the server side
if (typeof window !== 'undefined') {
  throw new Error('API Football client can only be used on the server side.');
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

// Zod Schemas for API Football responses

// Common paging schema
const ApiFootballPagingSchema = z.object({
  current: z.number(),
  total: z.number(),
});

// Common error schema from API Football
const ApiFootballErrorsSchema = z.union([
  z.array(z.string()),
  z.record(z.string(), z.string()),
  z.null(),
  z.undefined()
]);

// Base wrapper schema
function createApiFootballResponseSchema<T extends z.ZodTypeAny>(responseItemSchema: T) {
  return z.object({
    get: z.string(),
    parameters: z.record(z.string(), z.any()),
    errors: ApiFootballErrorsSchema,
    results: z.number(),
    paging: ApiFootballPagingSchema,
    response: responseItemSchema,
  });
}

// Specific data schemas

export const ApiFootballTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string().nullable().optional(),
  country: z.string().optional(),
  founded: z.number().nullable().optional(),
  national: z.boolean().optional(),
  logo: z.string().optional(),
});

export const ApiFootballVenueSchema = z.object({
  id: z.number().nullable().optional(),
  name: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  capacity: z.number().nullable().optional(),
  surface: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});

export const ApiFootballLeagueSchema = z.object({
  id: z.number(),
  name: z.string(),
  country: z.string(),
  logo: z.string().optional(),
  flag: z.string().nullable().optional(),
  season: z.number(),
  round: z.string().optional(),
});

export const ApiFootballFixtureSchema = z.object({
  id: z.number(),
  referee: z.string().nullable().optional(),
  timezone: z.string(),
  date: z.string(),
  timestamp: z.number(),
  periods: z.object({
    first: z.number().nullable().optional(),
    second: z.number().nullable().optional(),
  }).optional(),
  venue: ApiFootballVenueSchema.optional(),
  status: z.object({
    long: z.string(),
    short: z.string(),
    elapsed: z.number().nullable().optional(),
  }),
});

export const ApiFootballFixtureResponseItemSchema = z.object({
  fixture: ApiFootballFixtureSchema,
  league: ApiFootballLeagueSchema,
  teams: z.object({
    home: ApiFootballTeamSchema.extend({ winner: z.boolean().nullable().optional() }),
    away: ApiFootballTeamSchema.extend({ winner: z.boolean().nullable().optional() }),
  }),
  goals: z.object({
    home: z.number().nullable().optional(),
    away: z.number().nullable().optional(),
  }),
  score: z.object({
    halftime: z.object({ home: z.number().nullable().optional(), away: z.number().nullable().optional() }),
    fulltime: z.object({ home: z.number().nullable().optional(), away: z.number().nullable().optional() }),
    extratime: z.object({ home: z.number().nullable().optional(), away: z.number().nullable().optional() }),
    penalty: z.object({ home: z.number().nullable().optional(), away: z.number().nullable().optional() }),
  }),
});

// Single parameter or endpoint validation schemas
export const ApiFootballFixturesResponseSchema = createApiFootballResponseSchema(z.array(ApiFootballFixtureResponseItemSchema));

export type ApiFootballFixtureResponseItem = z.infer<typeof ApiFootballFixtureResponseItemSchema>;

interface FetchOptions {
  timeoutMs?: number;
}

export class ApiFootballClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    // Check both standard APIFOOTBALL_KEY and local convention API_FOOTBALL_KEY
    const key = process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY;
    if (!key) {
      this.apiKey = '';
    } else {
      this.apiKey = key;
    }

    this.baseUrl = process.env.APIFOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
  }

  private ensureApiKey(): void {
    if (!this.apiKey) {
      console.error('[ApiFootballClient] Error: API key is not defined in environment variables.');
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
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    
    Object.entries(params).forEach(([key, val]) => {
      url.searchParams.append(key, val);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();
    console.log(`[ApiFootballClient] Initiating request to endpoint: ${endpoint}`);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'x-apisports-key': this.apiKey,
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      console.log(`[ApiFootballClient] Request completed in ${duration}ms with status ${response.status}`);

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
        console.error(`[ApiFootballClient] Safe JSON parse failed for ${endpoint}. Raw: ${responseText.substring(0, 200)}`);
        throw new ApiError(
          `Invalid JSON response: ${err.message}`,
          endpoint,
          response.status
        );
      }

      if (!response.ok) {
        console.error(`[ApiFootballClient] API returned error status: ${response.status}`, responseData);
        throw new ApiError(
          `API error with status ${response.status}`,
          endpoint,
          response.status,
          responseData
        );
      }

      // API-Football returns errors inside the JSON response payload under "errors"
      if (responseData.errors && (Array.isArray(responseData.errors) ? responseData.errors.length > 0 : Object.keys(responseData.errors).length > 0)) {
        console.error(`[ApiFootballClient] API response reported errors:`, responseData.errors);
        throw new ApiError(
          `API response error: ${JSON.stringify(responseData.errors)}`,
          endpoint,
          response.status,
          responseData.errors
        );
      }

      // Schema validation with Zod
      const validationResult = schema.safeParse(responseData);
      if (!validationResult.success) {
        console.error(
          `[ApiFootballClient] Zod validation failed for endpoint ${endpoint}:`,
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
        console.error(`[ApiFootballClient] Request to ${endpoint} timed out after ${timeoutMs}ms.`);
        throw new ApiError(`Request timed out after ${timeoutMs}ms`, endpoint, 408);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      console.error(`[ApiFootballClient] Request to ${endpoint} failed with error:`, error);
      throw new ApiError(error.message || 'Unknown network error', endpoint, 500, error);
    }
  }

  /**
   * Fetch fixtures for a given league and season
   */
  public async getFixtures(
    league: number,
    season: number,
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballFixturesResponseSchema>> {
    return this.request(
      'fixtures',
      { league: String(league), season: String(season) },
      ApiFootballFixturesResponseSchema,
      options
    );
  }
}

export const apiFootballClient = new ApiFootballClient();
