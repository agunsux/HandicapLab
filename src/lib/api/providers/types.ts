import { LeagueConfig } from '@/lib/crons/leagueRegistry';

export interface NormalizedFixture {
  id: string;
  competitionId: string;
  competitionName: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string; // ISO string for kickoff
  status: 'upcoming' | 'live' | 'finished';
  season: number;
  homeTeamId: string;
  awayTeamId: string;
  tournamentStage?: string | null;
}

export interface FootballProvider {
  getFixtures(leagueConfig: LeagueConfig, season: number): Promise<NormalizedFixture[]>;
  getResults(leagueConfig: LeagueConfig, season: number): Promise<NormalizedFixture[]>;
  getStandings(leagueConfig: LeagueConfig, season: number): Promise<any>;
}
