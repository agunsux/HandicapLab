export interface LeagueConfig {
  id: number;
  name: string;
  cohort: 'WORLD_CUP' | 'EPL' | 'LIGUE2' | 'EUROPA' | 'OTHER';
  apiFootballId: number;
  oddsApiSportKey?: string;
}

export const LEAGUE_REGISTRY: LeagueConfig[] = [
  { id: 1, name: 'FIFA World Cup', cohort: 'WORLD_CUP', apiFootballId: 1, oddsApiSportKey: 'soccer_fifa_world_cup' },
  { id: 39, name: 'Premier League', cohort: 'EPL', apiFootballId: 39 },
  { id: 848, name: 'Ligue 2', cohort: 'LIGUE2', apiFootballId: 848 },
  // Add more league configurations as needed
];

export function getLeagueConfig(leagueId: number): LeagueConfig | null {
  return LEAGUE_REGISTRY.find(l => l.id === leagueId || l.apiFootballId === leagueId) ?? null;
}
