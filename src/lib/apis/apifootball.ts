import { z } from 'zod';
import { globalGateway } from '@/lib/providers/providerGateway';

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

// -- EPIC 52 Stage B: Injury Schema --
export const ApiFootballInjuryItemSchema = z.object({
  player: z.object({
    id: z.number(),
    name: z.string(),
    photo: z.string().optional(),
    type: z.string().optional(),
    reason: z.string().optional(),
  }),
  team: z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string().optional(),
  }),
  fixture: z.object({
    id: z.number().optional(),
    date: z.string().optional(),
  }).optional(),
  league: z.object({
    id: z.number().optional(),
    season: z.number().optional(),
  }).optional(),
});

export const ApiFootballInjuriesResponseSchema = createApiFootballResponseSchema(z.array(ApiFootballInjuryItemSchema));

export type ApiFootballInjuryItem = z.infer<typeof ApiFootballInjuryItemSchema>;

// -- EPIC 52 Stage B: Lineup Schema --
export const ApiFootballLineupItemSchema = z.object({
  team: z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string().optional(),
    colors: z.any().optional(),
  }),
  formation: z.string().optional(),
  startXI: z.array(z.object({
    player: z.object({
      id: z.number(),
      name: z.string(),
      number: z.number().optional(),
      pos: z.string().optional(),
      grid: z.string().optional(),
    }),
  })),
  substitutes: z.array(z.object({
    player: z.object({
      id: z.number(),
      name: z.string(),
      number: z.number().optional(),
      pos: z.string().optional(),
      grid: z.string().optional(),
    }),
  })).optional(),
  coach: z.array(z.object({
    id: z.number().optional(),
    name: z.string().optional(),
    photo: z.string().optional(),
  })).optional(),
});

export const ApiFootballLineupsResponseSchema = createApiFootballResponseSchema(z.array(ApiFootballLineupItemSchema));

export type ApiFootballLineupItem = z.infer<typeof ApiFootballLineupItemSchema>;

// -- EPIC 52 Stage B: Venue (for weather coords) --
export const ApiFootballVenueDetailSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  capacity: z.number().nullable().optional(),
  surface: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  coordinates: z.object({
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  }).optional(),
});

export const ApiFootballVenueResponseSchema = createApiFootballResponseSchema(z.array(ApiFootballVenueDetailSchema));

export type ApiFootballFixtureResponseItem = z.infer<typeof ApiFootballFixtureResponseItemSchema>;

// -- API-Football PRO: Fixture Statistics Schema --
export const ApiFootballStatisticValueSchema = z.object({
  type: z.string(),
  value: z.union([z.string(), z.number(), z.null(), z.undefined()]),
});

export const ApiFootballFixtureStatisticsItemSchema = z.object({
  team: z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string().optional(),
  }),
  statistics: z.array(ApiFootballStatisticValueSchema),
});

export const ApiFootballFixtureStatisticsResponseSchema = createApiFootballResponseSchema(
  z.array(ApiFootballFixtureStatisticsItemSchema)
);
export type ApiFootballFixtureStatisticsItem = z.infer<typeof ApiFootballFixtureStatisticsItemSchema>;

// -- API-Football PRO: Team Statistics Schema --
export const ApiFootballTeamStatisticsDataSchema = z.object({
  league: z.object({
    id: z.number().optional(),
    name: z.string().optional(),
    country: z.string().optional(),
    logo: z.string().optional(),
    flag: z.string().nullable().optional(),
    season: z.number().optional(),
  }).optional(),
  team: z.object({
    id: z.number().optional(),
    name: z.string().optional(),
    logo: z.string().optional(),
  }).optional(),
  form: z.string().nullable().optional(),
  fixtures: z.object({
    played: z.record(z.string(), z.number().nullable().optional()).optional(),
    wins: z.record(z.string(), z.number().nullable().optional()).optional(),
    draws: z.record(z.string(), z.number().nullable().optional()).optional(),
    loses: z.record(z.string(), z.number().nullable().optional()).optional(),
  }).optional(),
  goals: z.object({
    for: z.record(z.string(), z.any()).optional(),
    against: z.record(z.string(), z.any()).optional(),
  }).optional(),
  clean_sheet: z.record(z.string(), z.number().nullable().optional()).optional(),
  failed_to_score: z.record(z.string(), z.number().nullable().optional()).optional(),
  penalty: z.record(z.string(), z.any()).optional(),
  lineups: z.array(z.object({
    formation: z.string(),
    played: z.number(),
  })).optional(),
  cards: z.record(z.string(), z.any()).optional(),
});

export const ApiFootballTeamStatisticsResponseSchema = createApiFootballResponseSchema(
  ApiFootballTeamStatisticsDataSchema
);
export type ApiFootballTeamStatisticsData = z.infer<typeof ApiFootballTeamStatisticsDataSchema>;

// -- API-Football PRO: Odds Schemas --
export const ApiFootballOddValueSchema = z.object({
  value: z.union([z.string(), z.number()]),
  odd: z.string(),
  handicap: z.union([z.string(), z.number(), z.null()]).optional(),
  main: z.boolean().nullable().optional(),
  suspended: z.boolean().nullable().optional(),
});

export const ApiFootballOddBetSchema = z.object({
  id: z.number(),
  name: z.string(),
  values: z.array(ApiFootballOddValueSchema),
});

export const ApiFootballBookmakerSchema = z.object({
  id: z.number(),
  name: z.string(),
  bets: z.array(ApiFootballOddBetSchema),
});

export const ApiFootballOddsItemSchema = z.object({
  league: z.object({
    id: z.number(),
    name: z.string().optional(),
    country: z.string().optional(),
    logo: z.string().optional(),
    flag: z.string().nullable().optional(),
    season: z.number().optional(),
  }).optional(),
  fixture: z.object({
    id: z.number(),
    timezone: z.string().optional(),
    date: z.string().optional(),
    timestamp: z.number().optional(),
  }),
  update: z.string().optional(),
  bookmakers: z.array(ApiFootballBookmakerSchema),
});

export const ApiFootballOddsResponseSchema = createApiFootballResponseSchema(
  z.array(ApiFootballOddsItemSchema)
);
export type ApiFootballOddsItem = z.infer<typeof ApiFootballOddsItemSchema>;

// -- API-Football PRO: Bookmakers List Schema --
export const ApiFootballBookmakerMetaSchema = z.object({
  id: z.number(),
  name: z.string(),
});
export const ApiFootballBookmakersListResponseSchema = createApiFootballResponseSchema(
  z.array(ApiFootballBookmakerMetaSchema)
);

// -- API-Football PRO: Bets List Schema --
export const ApiFootballBetMetaSchema = z.object({
  id: z.number(),
  name: z.string(),
});
export const ApiFootballBetsListResponseSchema = createApiFootballResponseSchema(
  z.array(ApiFootballBetMetaSchema)
);

// -- API-Football PRO: Standings Schema --
export const ApiFootballStandingTeamDetailSchema = z.object({
  rank: z.number(),
  team: z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string().optional(),
  }),
  points: z.number(),
  goalsDiff: z.number(),
  group: z.string().optional(),
  form: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  all: z.object({
    played: z.number(),
    win: z.number(),
    draw: z.number(),
    lose: z.number(),
    goals: z.object({ for: z.number(), against: z.number() }),
  }).optional(),
  home: z.object({
    played: z.number(),
    win: z.number(),
    draw: z.number(),
    lose: z.number(),
    goals: z.object({ for: z.number(), against: z.number() }),
  }).optional(),
  away: z.object({
    played: z.number(),
    win: z.number(),
    draw: z.number(),
    lose: z.number(),
    goals: z.object({ for: z.number(), against: z.number() }),
  }).optional(),
  update: z.string().optional(),
});

export const ApiFootballStandingsItemSchema = z.object({
  league: z.object({
    id: z.number(),
    name: z.string(),
    country: z.string(),
    logo: z.string().optional(),
    flag: z.string().nullable().optional(),
    season: z.number(),
    standings: z.array(z.array(ApiFootballStandingTeamDetailSchema)),
  }),
});

export const ApiFootballStandingsResponseSchema = createApiFootballResponseSchema(
  z.array(ApiFootballStandingsItemSchema)
);
export type ApiFootballStandingsItem = z.infer<typeof ApiFootballStandingsItemSchema>;

interface FetchOptions {
  timeoutMs?: number;
}

export class ApiFootballClient {
  private baseUrl: string;
  private apiKey: string;
  private lastRequestTime: number = 0;
  private rateLimitDelayMs: number = 7000;

  constructor() {
    const key = process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY;
    if (!key) {
      this.apiKey = '';
    } else {
      this.apiKey = key;
    }
    this.baseUrl = process.env.APIFOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitDelayMs) {
      const wait = this.rateLimitDelayMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastRequestTime = Date.now();
  }

  private ensureApiKey(): void {
    if (!this.apiKey) { this.apiKey = (process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '').replace(/['"]/g, ''); }
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

    await this.enforceRateLimit();

    const { timeoutMs = 10000 } = options;

    for (let attempt = 1; attempt <= 3; attempt++) {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    
    Object.entries(params).forEach(([key, val]) => {
      url.searchParams.append(key, val);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();
    console.log(`[ApiFootballClient] Initiating request to endpoint: ${endpoint}`);

    try {
      const response = await globalGateway.fetch('apifootball', endpoint, url.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'x-apisports-key': this.apiKey,
          'Accept': 'application/json',
        },
        cacheTtlMs: 3600000, // 1 hour default cache
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

      // Retry on 429 rate limit or 5xx server errors
      const isRetryable = error instanceof ApiError && error.status !== undefined && (
        error.status === 429 || (error.status >= 500 && error.status < 600)
      );
      if (isRetryable && attempt < 3) {
        const backoffMs = error.status! === 429 ? 10000 * attempt : 5000 * attempt;
        console.warn(`[ApiFootballClient] Retry ${attempt}/3 after ${backoffMs}ms (status ${error.status})`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

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
  return undefined as unknown as T;
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

  /**
   * Fetch fixtures for a specific date (YYYY-MM-DD)
   */
  public async getFixturesByDate(
    date: string,
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballFixturesResponseSchema>> {
    return this.request(
      'fixtures',
      { date },
      ApiFootballFixturesResponseSchema,
      options
    );
  }

  /**
   * Fetch all currently live fixtures
   */
  public async getLiveFixtures(
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballFixturesResponseSchema>> {
    return this.request(
      'fixtures',
      { live: 'all' },
      ApiFootballFixturesResponseSchema,
      options
    );
  }

  /**
   * EPIC 52 Stage B â€” Fetch current injuries for a team or fixture
   */
  public async getInjuries(
    params: { team?: number; fixture?: number; league?: number; season?: number },
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballInjuriesResponseSchema>> {
    const query: Record<string, string> = {};
    if (params.team) query.team = String(params.team);
    if (params.fixture) query.fixture = String(params.fixture);
    if (params.league) query.league = String(params.league);
    if (params.season) query.season = String(params.season);
    return this.request('injuries', query, ApiFootballInjuriesResponseSchema, options);
  }

  /**
   * EPIC 52 Stage B â€” Fetch lineups for a specific fixture
   */
  public async getLineups(
    fixtureId: number,
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballLineupsResponseSchema>> {
    return this.request('lineups', { fixture: String(fixtureId) }, ApiFootballLineupsResponseSchema, options);
  }

  /**
   * EPIC 52 Stage B — Fetch venue details (for weather coordinates)
   */
  public async getVenue(
    venueId: number,
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballVenueResponseSchema>> {
    return this.request('venues', { id: String(venueId) }, ApiFootballVenueResponseSchema, options);
  }

  /**
   * API-Football PRO — Fetch statistics for a specific fixture (shots, xG, possession, fouls, etc.)
   */
  public async getFixtureStatistics(
    fixtureId: number,
    teamId?: number,
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballFixtureStatisticsResponseSchema>> {
    const params: Record<string, string> = { fixture: String(fixtureId) };
    if (teamId) params.team = String(teamId);
    return this.request('fixtures/statistics', params, ApiFootballFixtureStatisticsResponseSchema, {
      timeoutMs: 12000,
      ...options,
    });
  }

  /**
   * API-Football PRO — Fetch comprehensive season statistics for a team
   */
  public async getTeamStatistics(
    params: { league: number; season: number; team: number; date?: string },
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballTeamStatisticsResponseSchema>> {
    const query: Record<string, string> = {
      league: String(params.league),
      season: String(params.season),
      team: String(params.team),
    };
    if (params.date) query.date = params.date;
    return this.request('teams/statistics', query, ApiFootballTeamStatisticsResponseSchema, {
      timeoutMs: 15000,
      ...options,
    });
  }

  /**
   * API-Football PRO — Fetch pre-match odds (Asian Handicap, Over/Under, BTTS, 1X2, Bookmakers)
   * Recommended to filter by bookmaker (e.g. 4 for Pinnacle) and bet type to conserve payload size.
   */
  public async getOdds(
    params: {
      fixture?: number;
      league?: number;
      season?: number;
      date?: string;
      bookmaker?: number;
      bet?: number;
      page?: number;
    },
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballOddsResponseSchema>> {
    const query: Record<string, string> = {};
    if (params.fixture) query.fixture = String(params.fixture);
    if (params.league) query.league = String(params.league);
    if (params.season) query.season = String(params.season);
    if (params.date) query.date = params.date;
    if (params.bookmaker) query.bookmaker = String(params.bookmaker);
    if (params.bet) query.bet = String(params.bet);
    if (params.page) query.page = String(params.page);

    return this.request('odds', query, ApiFootballOddsResponseSchema, {
      timeoutMs: 15000,
      ...options,
    });
  }

  /**
   * API-Football PRO — Get list of supported bookmakers (Pinnacle = 4, Bet365 = 8, etc.)
   */
  public async getBookmakers(
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballBookmakersListResponseSchema>> {
    return this.request('odds/bookmakers', {}, ApiFootballBookmakersListResponseSchema, options);
  }

  /**
   * API-Football PRO — Get list of supported bet market types (Asian Handicap = 4, Over/Under = 5, BTTS = 8)
   */
  public async getBets(
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballBetsListResponseSchema>> {
    return this.request('odds/bets', {}, ApiFootballBetsListResponseSchema, options);
  }

  /**
   * API-Football PRO — Fetch live/in-play odds
   */
  public async getLiveOdds(
    params: { fixture?: number; league?: number; bet?: number } = {},
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballOddsResponseSchema>> {
    const query: Record<string, string> = {};
    if (params.fixture) query.fixture = String(params.fixture);
    if (params.league) query.league = String(params.league);
    if (params.bet) query.bet = String(params.bet);

    return this.request('odds/live', query, ApiFootballOddsResponseSchema, {
      timeoutMs: 10000,
      ...options,
    });
  }

  /**
   * API-Football PRO — Fetch standings for a league and season
   */
  public async getStandings(
    params: { league: number; season: number; team?: number },
    options?: FetchOptions
  ): Promise<z.infer<typeof ApiFootballStandingsResponseSchema>> {
    const query: Record<string, string> = {
      league: String(params.league),
      season: String(params.season),
    };
    if (params.team) query.team = String(params.team);
    return this.request('standings', query, ApiFootballStandingsResponseSchema, options);
  }
}

export const apiFootballClient = new ApiFootballClient();

