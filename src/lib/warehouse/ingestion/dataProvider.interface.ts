import {
  CanonicalCompetition,
  CanonicalSeason,
  CanonicalTeam,
  CanonicalFixture,
  CanonicalStandings,
  CanonicalPlayer,
  CanonicalBookmaker,
  CanonicalOddsSnapshot,
  CanonicalMarket
} from './canonical';

export interface IDataProvider {
  getProviderName(): string;
  healthCheck(): Promise<boolean>;
  getCompetitions(): Promise<CanonicalCompetition[]>;
  getSeasons(competitionApiId: number): Promise<CanonicalSeason[]>;
  getTeams(competitionApiId: number, seasonYear: number): Promise<CanonicalTeam[]>;
  getFixtures(competitionApiId: number, seasonYear: number): Promise<CanonicalFixture[]>;
  getFixture(fixtureApiId: number): Promise<CanonicalFixture>;
  getStandings(competitionApiId: number, seasonYear: number): Promise<CanonicalStandings[]>;
  getPlayers(teamApiId: number, seasonYear: number): Promise<CanonicalPlayer[]>;
  getBookmakers(): Promise<CanonicalBookmaker[]>;
  getMarkets(): Promise<CanonicalMarket[]>;
  getOddsSnapshots(fixtureApiId: number): Promise<CanonicalOddsSnapshot[]>;
}
