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
import { ProviderUnavailableError, RateLimitError, AuthenticationError } from './errors';

export class ApiFootballProvider implements IDataProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://v3.football.api-sports.io';
  }

  public getProviderName(): string {
    return 'api-football';
  }

  private async request(endpoint: string): Promise<any> {
    try {
      if (!this.apiKey) {
        throw new AuthenticationError(this.getProviderName());
      }
      
      const res = await fetch(`${this.baseUrl}/${endpoint}`, {
        headers: {
          'x-apisports-key': this.apiKey
        }
      });

      if (res.status === 429) {
        throw new RateLimitError(this.getProviderName(), 60);
      }

      if (res.status === 401 || res.status === 403) {
        throw new AuthenticationError(this.getProviderName());
      }

      if (!res.ok) {
        throw new ProviderUnavailableError(this.getProviderName(), `HTTP status ${res.status}`);
      }

      return await res.json();
    } catch (err: any) {
      if (err instanceof IngestionError) throw err;
      throw new ProviderUnavailableError(this.getProviderName(), err.message);
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const data = await this.request('status');
      return data?.response?.account?.active || false;
    } catch {
      return false;
    }
  }

  public async getCompetitions(): Promise<CanonicalCompetition[]> {
    const data = await this.request('leagues');
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
    const data = await this.request(`leagues?id=${competitionApiId}`);
    if (!data || !data.response || data.response.length === 0) return [];
    const league = data.response[0];
    return (league.seasons || []).map((s: any) =>
      IngestionNormalizer.toSeason(
        {
          competitionId: competitionApiId,
          year: s.year,
          startDate: s.start,
          endDate: s.end
        },
        this.getProviderName()
      )
    );
  }

  public async getTeams(competitionApiId: number, seasonYear: number): Promise<CanonicalTeam[]> {
    const data = await this.request(`teams?league=${competitionApiId}&season=${seasonYear}`);
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
    const data = await this.request(`fixtures?league=${competitionApiId}&season=${seasonYear}`);
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
          htHomeGoals: item.score.halftime?.home,
          htAwayGoals: item.score.halftime?.away,
          details: { events: item.events }
        },
        this.getProviderName()
      )
    );
  }

  public async getFixture(fixtureApiId: number): Promise<CanonicalFixture> {
    const data = await this.request(`fixtures?id=${fixtureApiId}`);
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
        htHomeGoals: item.score.halftime?.home,
        htAwayGoals: item.score.halftime?.away,
        details: { events: item.events }
      },
      this.getProviderName()
    );
  }

  public async getStandings(competitionApiId: number, seasonYear: number): Promise<CanonicalStandings[]> {
    const data = await this.request(`standings?league=${competitionApiId}&season=${seasonYear}`);
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
    const data = await this.request(`players?team=${teamApiId}&season=${seasonYear}`);
    if (!data || !data.response) return [];
    return data.response.map((item: any) => ({
      apiId: item.player.id,
      name: item.player.name,
      nationality: item.player.nationality,
      position: item.player.games?.[0]?.position || undefined
    }));
  }

  public async getBookmakers(): Promise<CanonicalBookmaker[]> {
    const data = await this.request('odds/bookmakers');
    if (!data || !data.response) return [];
    return data.response.map((item: any) => ({
      apiId: item.id,
      name: item.name
    }));
  }

  public async getMarkets(): Promise<CanonicalMarket[]> {
    const data = await this.request('odds/markets');
    if (!data || !data.response) return [];
    return data.response.map((item: any) => ({
      apiId: item.id,
      name: item.name
    }));
  }

  public async getOddsSnapshots(fixtureApiId: number): Promise<CanonicalOddsSnapshot[]> {
    const data = await this.request(`odds?fixture=${fixtureApiId}`);
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

// Make sure it compiles with import errors correctly
import { IngestionError } from './errors';
