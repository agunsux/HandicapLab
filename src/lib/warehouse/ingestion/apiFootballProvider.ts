import { z } from 'zod';
import { IDataProvider } from './dataProvider.interface';
import {
  CanonicalCompetition,
  CanonicalSeason,
  CanonicalTeam,
  CanonicalFixture,
  CanonicalStandings,
  CanonicalPlayer,
  CanonicalBookmaker,
  CanonicalMarket,
  CanonicalOddsSnapshot
} from './canonical';
import { IngestionNormalizer } from './normalizer';
import { HttpClient, RateLimiter, CircuitBreaker } from '@/lib/http';
import { ProviderUnavailableError, RateLimitError, AuthenticationError, IngestionError } from './errors';

// Endpoint Validation Schemas
const StatusResponseSchema = z.object({
  response: z.object({
    account: z.object({
      active: z.boolean(),
    }).passthrough(),
  }).passthrough(),
}).passthrough();

const LeaguesResponseSchema = z.object({
  response: z.array(z.object({
    league: z.object({ id: z.number(), name: z.string(), type: z.string(), logo: z.string().optional().nullable() }),
    country: z.object({ name: z.string() }),
    seasons: z.array(z.object({
      year: z.number(),
      start: z.string().optional().nullable(),
      end: z.string().optional().nullable(),
    })).optional(),
  })),
}).passthrough();

const TeamsResponseSchema = z.object({
  response: z.array(z.object({
    team: z.object({ id: z.number(), name: z.string(), country: z.string().optional().nullable(), logo: z.string().optional().nullable() }),
  })),
}).passthrough();

const FixturesResponseSchema = z.object({
  response: z.array(z.object({
    fixture: z.object({ id: z.number(), date: z.string(), referee: z.string().optional().nullable(), venue: z.object({ name: z.string().optional().nullable(), city: z.string().optional().nullable() }).optional().nullable(), status: z.object({ short: z.string() }) }),
    league: z.object({ id: z.number(), season: z.number().optional() }),
    teams: z.object({ home: z.object({ id: z.number() }), away: z.object({ id: z.number() }) }),
    goals: z.object({ home: z.number().optional().nullable(), away: z.number().optional().nullable() }),
    score: z.object({ halftime: z.object({ home: z.number().optional().nullable(), away: z.number().optional().nullable() }).optional().nullable() }).optional().nullable(),
    events: z.array(z.any()).optional().nullable(),
  })),
}).passthrough();

const StandingsResponseSchema = z.object({
  response: z.array(z.object({
    league: z.object({
      standings: z.array(z.array(z.object({
        rank: z.number(),
        team: z.object({ id: z.number() }),
        points: z.number(),
        goalsDiff: z.number(),
        form: z.string().optional().nullable(),
      }))),
    }),
  })),
}).passthrough();

const PlayersResponseSchema = z.object({
  response: z.array(z.object({
    player: z.object({ id: z.number(), name: z.string(), nationality: z.string().optional().nullable() }),
    games: z.array(z.object({ position: z.string().optional().nullable() })).optional().nullable(),
  })),
}).passthrough();

const BookmakersResponseSchema = z.object({
  response: z.array(z.object({
    id: z.number(),
    name: z.string(),
  })),
}).passthrough();

const MarketsResponseSchema = z.object({
  response: z.array(z.object({
    id: z.number(),
    name: z.string(),
  })),
}).passthrough();

const OddsSnapshotsResponseSchema = z.object({
  response: z.array(z.object({
    update: z.string().optional().nullable(),
    bookmakers: z.array(z.object({
      id: z.number(),
      bets: z.array(z.object({
        id: z.number(),
        values: z.array(z.object({
          value: z.any(),
          odd: z.any(),
        })),
      })),
    })).optional().nullable(),
  })),
}).passthrough();

export class ApiFootballProvider implements IDataProvider {
  private readonly client: HttpClient;
  private readonly apiKey: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;

    const rateLimiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 60000,
      provider: 'api-football-warehouse',
    });
    const circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      cooldownMs: 60000,
      halfOpenSuccessThreshold: 2,
      provider: 'api-football-warehouse',
    });

    this.client = new HttpClient(
      {
        baseUrl: config.baseUrl || 'https://v3.football.api-sports.io',
        defaultHeaders: {
          'x-apisports-key': config.apiKey,
          'Accept': 'application/json',
        },
        provider: 'api-football-warehouse',
      },
      rateLimiter,
      circuitBreaker
    );
  }

  public getProviderName(): string {
    return 'api-football';
  }

  private async request<T>(endpoint: string, schema: z.ZodSchema<T>): Promise<T> {
    try {
      if (!this.apiKey) {
        throw new AuthenticationError(this.getProviderName());
      }
      
      const response = await this.client.get<T>(`/${endpoint}`, {
        schema
      });

      return response.data;
    } catch (err: any) {
      if (err instanceof IngestionError) throw err;
      if (err.status === 429 || err.code === 'RATE_LIMITED') {
        throw new RateLimitError(this.getProviderName(), 60);
      }
      if (err.status === 401 || err.status === 403) {
        throw new AuthenticationError(this.getProviderName());
      }
      throw new ProviderUnavailableError(this.getProviderName(), err.message);
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const data = await this.request('status', StatusResponseSchema);
      return data?.response?.account?.active || false;
    } catch {
      return false;
    }
  }

  public async getCompetitions(): Promise<CanonicalCompetition[]> {
    const data = await this.request('leagues', LeaguesResponseSchema);
    if (!data || !data.response) return [];
    return data.response.map((item: any) =>
      IngestionNormalizer.toCompetition(
        {
          id: item.league.id,
          name: item.league.name,
          country: item.country.name,
          type: item.league.type,
          logo: item.league.logo
        },
        this.getProviderName()
      )
    );
  }

  public async getSeasons(competitionApiId: number): Promise<CanonicalSeason[]> {
    const data = await this.request(`leagues?id=${competitionApiId}`, LeaguesResponseSchema);
    if (!data || !data.response || data.response.length === 0) return [];
    const league = data.response[0];
    return (league.seasons || []).map((s: any) =>
      IngestionNormalizer.toSeason(
        {
          competitionId: competitionApiId,
          year: s.year,
          start: s.start,
          end: s.end
        },
        this.getProviderName()
      )
    );
  }

  public async getTeams(competitionApiId: number, seasonYear: number): Promise<CanonicalTeam[]> {
    const data = await this.request(`teams?league=${competitionApiId}&season=${seasonYear}`, TeamsResponseSchema);
    if (!data || !data.response) return [];
    return data.response.map((item: any) =>
      IngestionNormalizer.toTeam(
        {
          id: item.team.id,
          name: item.team.name,
          country: item.team.country,
          logoUrl: item.team.logo
        },
        this.getProviderName()
      )
    );
  }

  public async getFixtures(competitionApiId: number, seasonYear: number): Promise<CanonicalFixture[]> {
    const data = await this.request(`fixtures?league=${competitionApiId}&season=${seasonYear}`, FixturesResponseSchema);
    if (!data || !data.response) return [];
    return data.response.map((item: any) =>
      IngestionNormalizer.toFixture(
        {
          id: item.fixture.id,
          competitionId: competitionApiId,
          seasonYear: seasonYear,
          kickoff: item.fixture.date,
          status: item.fixture.status.short,
          refereeName: item.fixture.referee,
          venueName: item.fixture.venue?.name,
          venueCity: item.fixture.venue?.city,
          homeTeamId: item.teams.home.id,
          awayTeamId: item.teams.away.id,
          homeGoals: item.goals.home,
          awayGoals: item.goals.away,
          htHomeGoals: item.score?.halftime?.home,
          htAwayGoals: item.score?.halftime?.away,
          details: { events: item.events }
        },
        this.getProviderName()
      )
    );
  }

  public async getFixture(fixtureApiId: number): Promise<CanonicalFixture> {
    const data = await this.request(`fixtures?id=${fixtureApiId}`, FixturesResponseSchema);
    if (!data || !data.response || data.response.length === 0) {
      throw new Error(`Fixture ${fixtureApiId} not found`);
    }
    const item = data.response[0];
    return IngestionNormalizer.toFixture(
      {
        id: item.fixture.id,
        competitionId: item.league.id,
        seasonYear: item.league.season,
        kickoff: item.fixture.date,
        status: item.fixture.status.short,
        refereeName: item.fixture.referee,
        venueName: item.fixture.venue?.name,
        venueCity: item.fixture.venue?.city,
        homeTeamId: item.teams.home.id,
        awayTeamId: item.teams.away.id,
        homeGoals: item.goals.home,
        awayGoals: item.goals.away,
        htHomeGoals: item.score?.halftime?.home,
        htAwayGoals: item.score?.halftime?.away,
        details: { events: item.events }
      },
      this.getProviderName()
    );
  }

  public async getStandings(competitionApiId: number, seasonYear: number): Promise<CanonicalStandings[]> {
    const data = await this.request(`standings?league=${competitionApiId}&season=${seasonYear}`, StandingsResponseSchema);
    if (!data || !data.response || data.response.length === 0) return [];
    const league = data.response[0].league;
    
    return (league.standings || []).map((standingGroup: any[], idx: number) => {
      const rows = standingGroup.map((item: any) => ({
        rank: item.rank,
        teamApiId: item.team.id,
        points: item.points,
        goalsDiff: item.goalsDiff,
        form: item.form
      }));
      
      return {
        competitionApiId,
        seasonYear,
        round: idx + 1,
        rows
      };
    });
  }

  public async getPlayers(teamApiId: number, seasonYear: number): Promise<CanonicalPlayer[]> {
    const data = await this.request(`players?team=${teamApiId}&season=${seasonYear}`, PlayersResponseSchema);
    if (!data || !data.response) return [];
    return data.response.map((item: any) => ({
      apiId: item.player.id,
      name: item.player.name,
      nationality: item.player.nationality,
      position: item.player.games?.[0]?.position || undefined
    }));
  }

  public async getBookmakers(): Promise<CanonicalBookmaker[]> {
    const data = await this.request('odds/bookmakers', BookmakersResponseSchema);
    if (!data || !data.response) return [];
    return data.response.map((item: any) => ({
      apiId: item.id,
      name: item.name
    }));
  }

  public async getMarkets(): Promise<CanonicalMarket[]> {
    const data = await this.request('odds/markets', MarketsResponseSchema);
    if (!data || !data.response) return [];
    return data.response.map((item: any) => ({
      apiId: item.id,
      name: item.name
    }));
  }

  public async getOddsSnapshots(fixtureApiId: number): Promise<CanonicalOddsSnapshot[]> {
    const data = await this.request(`odds?fixture=${fixtureApiId}`, OddsSnapshotsResponseSchema);
    if (!data || !data.response || data.response.length === 0) return [];
    const responseItem = data.response[0];
    
    const snapshots: CanonicalOddsSnapshot[] = [];
    
    for (const bookie of responseItem.bookmakers || []) {
      for (const market of bookie.bets || []) {
        snapshots.push(
          IngestionNormalizer.toOddsSnapshot(
            {
              fixtureId: fixtureApiId,
              bookmakerId: bookie.id,
              marketId: market.id,
              timestamp: responseItem.update || new Date().toISOString(),
              outcomes: (market.values || []).map((v: any) => ({
                selection: v.value,
                odds: v.odd
              }))
            },
            this.getProviderName()
          )
        );
      }
    }
    
    return snapshots;
  }
}
