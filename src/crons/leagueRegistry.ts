// League Registry — Market Suitability Configurations
// Location: src/crons/leagueRegistry.ts

export interface LeagueConfig {
  id: string;
  name: string;
  marketSuitability: {
    ML: boolean;
    AH: boolean;
    OU: boolean;
    BTTS?: boolean;
  };
  averageGoals?: number;
  homeAdvantage?: number;
}

const LEAGUE_REGISTRY: Record<string, LeagueConfig> = {
  'EPL': {
    id: 'EPL',
    name: 'English Premier League',
    marketSuitability: { ML: true, AH: true, OU: true, BTTS: true },
    averageGoals: 2.8,
    homeAdvantage: 0.4,
  },
  'La Liga': {
    id: 'La Liga',
    name: 'La Liga',
    marketSuitability: { ML: true, AH: true, OU: true, BTTS: true },
    averageGoals: 2.6,
    homeAdvantage: 0.35,
  },
  'Serie A': {
    id: 'Serie A',
    name: 'Serie A',
    marketSuitability: { ML: true, AH: true, OU: true, BTTS: true },
    averageGoals: 2.5,
    homeAdvantage: 0.4,
  },
  'Bundesliga': {
    id: 'Bundesliga',
    name: 'Bundesliga',
    marketSuitability: { ML: true, AH: true, OU: true, BTTS: true },
    averageGoals: 3.0,
    homeAdvantage: 0.5,
  },
  'Ligue 1': {
    id: 'Ligue 1',
    name: 'Ligue 1',
    marketSuitability: { ML: true, AH: true, OU: true, BTTS: true },
    averageGoals: 2.7,
    homeAdvantage: 0.35,
  },
};

export function getLeagueConfig(leagueId: number): LeagueConfig | undefined {
  return LEAGUE_REGISTRY[String(leagueId)] || undefined;
}

export function getLeagueConfigById(leagueId: string): LeagueConfig | undefined {
  return LEAGUE_REGISTRY[leagueId] || undefined;
}

export function getMarketSuitability(
  leagueId: string,
  marketType: 'ML' | 'AH' | 'OU'
): boolean {
  const config = LEAGUE_REGISTRY[leagueId];
  if (!config) return true;
  return config.marketSuitability[marketType] !== false;
}
