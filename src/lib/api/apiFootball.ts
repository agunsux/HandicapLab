import { rateLimiter } from './rateLimiter';
import { apiCache } from './cache';

export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: any[] | Record<string, string>;
  results: number;
  paging: { current: number; total: number };
  response: T;
}

export class ApiFootballClient {
  private baseUrl = 'https://v3.football.api-sports.io';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.API_FOOTBALL_KEY || 'mock';
  }

  private isMockMode(): boolean {
    return this.apiKey === 'mock' || !this.apiKey;
  }

  private async request<T>(endpoint: string, params: Record<string, any>): Promise<T> {
    // 1. Check cache first
    const cachedData = apiCache.get<T>(endpoint, params);
    if (cachedData !== null) {
      return cachedData;
    }

    // 2. If mock mode, return mock data
    if (this.isMockMode()) {
      const mockResponse = this.generateMockResponse<T>(endpoint, params);
      apiCache.set(endpoint, params, mockResponse);
      return mockResponse;
    }

    // 3. Otherwise, check rate limiter, execute real API call and cache
    await rateLimiter.registerRequest();

    const url = new URL(`${this.baseUrl}/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, String(params[key])));

    console.log(`[ApiFootballClient] Fetching live data from: ${url.toString()}`);
    
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-apisports-key': this.apiKey,
        },
      });

      if (!res.ok) {
        throw new Error(`API-Football error status: ${res.status} ${res.statusText}`);
      }

      const data = await res.json() as ApiFootballResponse<T>;
      
      // API-Football returns errors in response body under "errors" property
      if (data.errors && (Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors).length > 0)) {
        console.error('[ApiFootballClient] API response errors:', data.errors);
        throw new Error(`API-Football response error: ${JSON.stringify(data.errors)}`);
      }

      const responsePayload = data.response;
      apiCache.set(endpoint, params, responsePayload);
      return responsePayload;
    } catch (e) {
      console.error(`[ApiFootballClient] Network request failed for ${endpoint}:`, e);
      throw e;
    }
  }

  public async getFixtures(league: number, season: number): Promise<any[]> {
    return this.request<any[]>('fixtures', { league, season });
  }

  public async getFixtureStatistics(fixture: number): Promise<any[]> {
    return this.request<any[]>('fixtures/statistics', { fixture });
  }

  public async getTeamStatistics(league: number, season: number, team: number): Promise<any> {
    return this.request<any>('teams/statistics', { league, season, team });
  }

  /**
   * Helper to generate mock data when key is set to 'mock'
   */
  private generateMockResponse<T>(endpoint: string, params: Record<string, any>): T {
    console.log(`[ApiFootballClient] Generating mock response for endpoint: ${endpoint} params:`, params);
    
    if (endpoint === 'fixtures') {
      const league = Number(params.league || 39);
      const season = Number(params.season || 2024);
      let leagueName = 'Premier League';
      let teams = [
        { id: 1, name: 'Arsenal' },
        { id: 2, name: 'Chelsea' },
        { id: 3, name: 'Liverpool' },
        { id: 4, name: 'Manchester City' },
        { id: 5, name: 'Manchester United' },
        { id: 6, name: 'Tottenham' },
        { id: 7, name: 'Aston Villa' },
        { id: 8, name: 'Newcastle' },
        { id: 9, name: 'West Ham' },
        { id: 10, name: 'Everton' },
      ];

      if (league === 1) {
        leagueName = 'FIFA World Cup';
        teams = [
          { id: 501, name: 'Argentina' },
          { id: 502, name: 'France' },
          { id: 503, name: 'Brazil' },
          { id: 504, name: 'Germany' },
          { id: 505, name: 'Spain' },
          { id: 506, name: 'England' },
          { id: 507, name: 'Portugal' },
          { id: 508, name: 'Netherlands' },
          { id: 509, name: 'Belgium' },
          { id: 510, name: 'Italy' },
        ];
      } else if (league === 39) {
        leagueName = 'Premier League';
      } else if (league === 2) {
        leagueName = 'UEFA Champions League';
      } else if (league === 140) {
        leagueName = 'La Liga';
      } else if (league === 135) {
        leagueName = 'Serie A';
      } else if (league === 78) {
        leagueName = 'Bundesliga';
      } else if (league === 61) {
        leagueName = 'Ligue 1';
      } else if (league === 848) {
        leagueName = 'Ligue 2';
      }

      // Generate 10 mock fixtures
      const mockFixtures = [];

      for (let i = 0; i < 10; i++) {
        const fixtureId = 200000 + i;
        const homeTeam = teams[i % teams.length];
        const awayTeam = teams[(i + 1) % teams.length];
        
        // Random goals
        const htHome = Math.floor(Math.random() * 2);
        const htAway = Math.floor(Math.random() * 2);
        const shHome = Math.floor(Math.random() * 2);
        const shAway = Math.floor(Math.random() * 2);

        const isFinished = league !== 1 && i < 7; // Keep some upcoming for World Cup

        mockFixtures.push({
          fixture: {
            id: fixtureId,
            referee: 'Michael Oliver',
            timezone: 'UTC',
            date: isFinished 
              ? new Date(Date.now() - (10 - i) * 86400 * 1000).toISOString()
              : new Date(Date.now() + (i + 1) * 86400 * 1000).toISOString(),
            timestamp: Math.floor((Date.now() + (isFinished ? -(10 - i) : (i + 1)) * 86400 * 1000) / 1000),
            periods: { first: null, second: null },
            venue: { id: 1, name: 'Emirates Stadium', city: 'London' },
            status: isFinished 
              ? { long: 'Match Finished', short: 'FT', elapsed: 90 }
              : { long: 'Not Started', short: 'NS', elapsed: 0 }
          },
          league: { id: league, name: leagueName, country: league === 1 ? 'World' : 'England', logo: '', flag: '', season: season, round: league === 1 ? 'Group Stage' : 'Regular Season - ' + (i + 1) },
          teams: {
            home: { id: homeTeam.id, name: homeTeam.name, logo: '', winner: isFinished ? htHome + shHome > htAway + shAway : null },
            away: { id: awayTeam.id, name: awayTeam.name, logo: '', winner: isFinished ? htAway + shAway > htHome + shHome : null }
          },
          goals: isFinished ? { home: htHome + shHome, away: htAway + shAway } : { home: null, away: null },
          score: isFinished ? {
            halftime: { home: htHome, away: htAway },
            fulltime: { home: htHome + shHome, away: htAway + shAway },
            extratime: { home: null, away: null },
            penalty: { home: null, away: null }
          } : {
            halftime: { home: null, away: null },
            fulltime: { home: null, away: null },
            extratime: { home: null, away: null },
            penalty: { home: null, away: null }
          }
        });
      }
      return mockFixtures as unknown as T;
    }

    if (endpoint === 'fixtures/statistics') {
      const fixtureId = Number(params.fixture || 0);
      
      // Return statistics for home and away
      const mockStats = [
        {
          team: { id: 1, name: 'Home Team', logo: '' },
          statistics: [
            { type: 'Shots on Goal', value: 5 },
            { type: 'Shots off Goal', value: 7 },
            { type: 'Total Shots', value: 12 },
            { type: 'Blocked Shots', value: 2 },
            { type: 'Shots insidebox', value: 8 },
            { type: 'Shots outsidebox', value: 4 },
            { type: 'Fouls', value: 10 },
            { type: 'Corner Kicks', value: 6 },
            { type: 'Offsides', value: 2 },
            { type: 'Ball Possession', value: '52%' },
            { type: 'Yellow Cards', value: 2 },
            { type: 'Red Cards', value: 0 },
            { type: 'Goalkeeper Saves', value: 3 },
            { type: 'Total passes', value: 480 },
            { type: 'Passes accurate', value: 400 },
            { type: 'Passes %', value: '83%' },
            { type: 'Dangerous Attacks', value: 46 }
          ]
        },
        {
          team: { id: 2, name: 'Away Team', logo: '' },
          statistics: [
            { type: 'Shots on Goal', value: 3 },
            { type: 'Shots off Goal', value: 5 },
            { type: 'Total Shots', value: 8 },
            { type: 'Blocked Shots', value: 1 },
            { type: 'Shots insidebox', value: 4 },
            { type: 'Shots outsidebox', value: 4 },
            { type: 'Fouls', value: 12 },
            { type: 'Corner Kicks', value: 4 },
            { type: 'Offsides', value: 1 },
            { type: 'Ball Possession', value: '48%' },
            { type: 'Yellow Cards', value: 3 },
            { type: 'Red Cards', value: 0 },
            { type: 'Goalkeeper Saves', value: 5 },
            { type: 'Total passes', value: 440 },
            { type: 'Passes accurate', value: 360 },
            { type: 'Passes %', value: '82%' },
            { type: 'Dangerous Attacks', value: 38 }
          ]
        }
      ];
      return mockStats as unknown as T;
    }

    if (endpoint === 'teams/statistics') {
      const league = Number(params.league || 39);
      const season = Number(params.season || 2024);
      const team = Number(params.team || 1);

      return {
        league: { id: league, name: 'League', country: 'Country', season },
        team: { id: team, name: 'Mock Team', logo: '' },
        form: 'WDLWW',
        fixtures: { played: { total: 10 }, wins: { total: 6 }, draws: { total: 2 }, loses: { total: 2 } },
        goals: {
          for: { total: { home: 12, away: 8, total: 20 } },
          against: { total: { home: 5, away: 7, total: 12 } }
        }
      } as unknown as T;
    }

    return {} as T;
  }
}

export const apiFootballClient = new ApiFootballClient();

export async function fetchUpcomingFixtures(league = 39, season = 2024): Promise<any[]> {
  const fixtures = await apiFootballClient.getFixtures(league, season);
  let upcoming = fixtures.filter(f => f.fixture.status.short !== 'FT');
  if (upcoming.length === 0) {
    // Fallback for testing: return first 10 matches if no upcoming scheduled matches exist
    upcoming = fixtures.slice(0, 10);
  }
  return upcoming;
}
