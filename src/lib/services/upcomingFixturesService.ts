import {
  CanonicalFixtureRegistry,
  type CanonicalFixture,
  type FixtureDataState,
  type MarketOddsItem as RegistryMarketOddsItem
} from './canonicalFixtureRegistry';

export type MarketOddsItem = RegistryMarketOddsItem;

export interface PublicUpcomingFixture {
  id: number | string;
  fixtureId?: string;
  leagueId: number;
  leagueCode: string;
  leagueName: string;
  leagueCountry: string;
  leagueLogo?: string;
  kickoff: string; // ISO 8601
  kickoffDate: string; // YYYY-MM-DD
  kickoffTime: string; // HH:mm UTC
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  venue?: string;
  status: string;
  markets: {
    asianHandicap: MarketOddsItem;
    overUnder: MarketOddsItem;
    btts: MarketOddsItem;
  };
}

export interface UpcomingFixturesResult {
  fixtures: PublicUpcomingFixture[];
  totalMatchesAvailable?: number;
  generatedAt: string;
  source: 'api-football';
  dataState: FixtureDataState;
  coverage: {
    leagues: number;
    fixtures: number;
  };
}

export class UpcomingFixturesService {
  /**
   * Fetch upcoming fixtures for the specified date window (up to 7 days ahead).
   * Strictly delegates to the canonical fixture registry (single source of truth).
   */
  public static async getUpcomingFixtures(options: {
    daysAhead?: number; // 1 to 7 days
    forceRefresh?: boolean;
    leagueCode?: string;
    limit?: number;
  } = {}): Promise<UpcomingFixturesResult> {
    const { daysAhead = 7, forceRefresh = false, leagueCode, limit } = options;

    let horizon: 'TODAY' | 'TOMORROW' | 'NEXT_7_DAYS' = 'NEXT_7_DAYS';
    if (daysAhead === 1) horizon = 'TODAY';
    else if (daysAhead === 2) horizon = 'TOMORROW';

    const registryRes = await CanonicalFixtureRegistry.getUpcomingFixtures({
      horizon: daysAhead >= 3 ? 'NEXT_7_DAYS' : horizon,
      limit: limit || 50,
      forceRefresh,
    });

    const mappedFixtures: PublicUpcomingFixture[] = registryRes.fixtures.map((f) => ({
      id: Number(f.providerFixtureId) || f.fixtureId,
      fixtureId: f.fixtureId,
      leagueId: f.competitionId,
      leagueCode: f.leagueCode || 'ENG-PL',
      leagueName: f.competitionName,
      leagueCountry: f.leagueCountry || 'England',
      leagueLogo: f.leagueLogo,
      kickoff: f.kickoffUtc,
      kickoffDate: f.kickoffUtc.slice(0, 10),
      kickoffTime: f.kickoffUtc.slice(11, 16),
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      homeLogo: f.homeLogo,
      awayLogo: f.awayLogo,
      venue: f.venue,
      status: f.status,
      markets: f.markets,
    }));

    return this.filterResult(
      {
        fixtures: mappedFixtures,
        totalMatchesAvailable: registryRes.totalMatchesAvailable,
        generatedAt: registryRes.generatedAt,
        source: 'api-football',
        dataState: registryRes.dataState,
        coverage: registryRes.coverage,
      },
      daysAhead,
      leagueCode,
      limit
    );
  }

  private static filterResult(
    result: UpcomingFixturesResult,
    daysAhead: number,
    leagueCode?: string,
    limit?: number
  ): UpcomingFixturesResult {
    const now = new Date();
    const cutoffTime = now.getTime() + daysAhead * 24 * 60 * 60 * 1000;

    let filtered = result.fixtures.filter((f) => {
      const matchTime = new Date(f.kickoff).getTime();
      return matchTime >= now.getTime() - 2 * 60 * 60 * 1000 && matchTime <= cutoffTime;
    });

    if (leagueCode) {
      filtered = filtered.filter((f) => f.leagueCode.toLowerCase() === leagueCode.toLowerCase());
    }

    const totalAvailable = filtered.length;
    const finalFixtures = limit ? filtered.slice(0, limit) : filtered;
    const distinctLeagues = new Set(finalFixtures.map((f) => f.leagueId)).size;

    return {
      fixtures: finalFixtures,
      totalMatchesAvailable: totalAvailable,
      generatedAt: result.generatedAt,
      source: result.source,
      dataState: result.dataState,
      coverage: {
        leagues: distinctLeagues,
        fixtures: finalFixtures.length
      }
    };
  }
}
