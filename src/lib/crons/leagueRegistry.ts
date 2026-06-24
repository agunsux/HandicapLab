export type GoalEnvironmentType = 'low' | 'medium-low' | 'medium' | 'medium-high' | 'high';
export type VarianceType = 'low' | 'medium' | 'medium-high' | 'high';
export type MarketLiquidityType = 'high' | 'medium' | 'low';
export type CompetitionStatus = 'ACTIVE' | 'BETA' | 'DISABLED';

export interface CompetitionProfileConfig {
  goalEnvironment: GoalEnvironmentType;
  homeAdvantage: number;
  variance: VarianceType;
  fatigueSensitivity: number;
  marketLiquidity: MarketLiquidityType;
}

export interface LeagueConfig {
  id: string;
  name: string;
  country: string;
  type: 'club' | 'international';
  enabled: boolean;
  marketPriority: ('AH' | 'OU' | 'ML')[];
  profile: CompetitionProfileConfig;
  marketSuitability: {
    AH: boolean;
    OU: boolean;
    ML: boolean;
  };
  apiFootballId: number;
  oddsApiSportKey?: string;
  status: CompetitionStatus;
  cohort: 'WORLD_CUP' | 'EPL' | 'LIGUE2' | 'EUROPA' | 'OTHER';
  minimumHistoricalMatches?: number;
}

export const LEAGUE_REGISTRY: LeagueConfig[] = [
  {
    id: 'eng_premier_league',
    name: 'Premier League',
    country: 'England',
    type: 'club',
    enabled: true,
    marketPriority: ['AH', 'OU', 'ML'],
    profile: {
      goalEnvironment: 'medium-high',
      homeAdvantage: 1.12,
      variance: 'medium',
      fatigueSensitivity: 1.0,
      marketLiquidity: 'high'
    },
    marketSuitability: { AH: true, OU: true, ML: true },
    apiFootballId: 39,
    status: 'ACTIVE',
    cohort: 'EPL',
    minimumHistoricalMatches: 10
  },
  {
    id: 'uefa_champions_league',
    name: 'UEFA Champions League',
    country: 'Europe',
    type: 'club',
    enabled: true,
    marketPriority: ['AH', 'OU', 'ML'],
    profile: {
      goalEnvironment: 'medium',
      homeAdvantage: 1.08, // low-medium Home Advantage
      variance: 'high',
      fatigueSensitivity: 1.2,
      marketLiquidity: 'high'
    },
    marketSuitability: { AH: true, OU: true, ML: true },
    apiFootballId: 2,
    status: 'ACTIVE',
    cohort: 'EUROPA',
    minimumHistoricalMatches: 5
  },
  {
    id: 'esp_la_liga',
    name: 'La Liga',
    country: 'Spain',
    type: 'club',
    enabled: true,
    marketPriority: ['AH', 'OU', 'ML'],
    profile: {
      goalEnvironment: 'medium',
      homeAdvantage: 1.12,
      variance: 'medium',
      fatigueSensitivity: 1.0,
      marketLiquidity: 'high'
    },
    marketSuitability: { AH: true, OU: true, ML: true },
    apiFootballId: 140,
    status: 'ACTIVE',
    cohort: 'OTHER',
    minimumHistoricalMatches: 10
  },
  {
    id: 'ita_serie_a',
    name: 'Serie A',
    country: 'Italy',
    type: 'club',
    enabled: true,
    marketPriority: ['AH', 'OU', 'ML'],
    profile: {
      goalEnvironment: 'medium-low',
      homeAdvantage: 1.12,
      variance: 'medium',
      fatigueSensitivity: 1.0,
      marketLiquidity: 'medium'
    },
    marketSuitability: { AH: true, OU: true, ML: true },
    apiFootballId: 135,
    status: 'ACTIVE',
    cohort: 'OTHER',
    minimumHistoricalMatches: 10
  },
  {
    id: 'ger_bundesliga',
    name: 'Bundesliga',
    country: 'Germany',
    type: 'club',
    enabled: true,
    marketPriority: ['AH', 'OU', 'ML'],
    profile: {
      goalEnvironment: 'high',
      homeAdvantage: 1.12,
      variance: 'medium-high',
      fatigueSensitivity: 1.0,
      marketLiquidity: 'high'
    },
    marketSuitability: { AH: true, OU: true, ML: true },
    apiFootballId: 78,
    status: 'ACTIVE',
    cohort: 'OTHER',
    minimumHistoricalMatches: 10
  },
  {
    id: 'fra_ligue_1',
    name: 'Ligue 1',
    country: 'France',
    type: 'club',
    enabled: true,
    marketPriority: ['AH', 'OU', 'ML'],
    profile: {
      goalEnvironment: 'medium',
      homeAdvantage: 1.12,
      variance: 'medium',
      fatigueSensitivity: 1.0,
      marketLiquidity: 'medium'
    },
    marketSuitability: { AH: true, OU: true, ML: true },
    apiFootballId: 61,
    status: 'ACTIVE',
    cohort: 'OTHER',
    minimumHistoricalMatches: 10
  },
  {
    id: 'world_cup_2026',
    name: 'FIFA World Cup',
    country: 'World',
    type: 'international',
    enabled: true,
    marketPriority: ['AH', 'OU', 'ML'],
    profile: {
      goalEnvironment: 'medium-low',
      homeAdvantage: 1.02,
      variance: 'high',
      fatigueSensitivity: 1.3,
      marketLiquidity: 'high'
    },
    marketSuitability: { AH: true, OU: true, ML: true },
    apiFootballId: 1,
    oddsApiSportKey: 'soccer_fifa_world_cup',
    status: 'ACTIVE',
    cohort: 'WORLD_CUP',
    minimumHistoricalMatches: 3
  },
  {
    id: 'fra_ligue_2',
    name: 'Ligue 2',
    country: 'France',
    type: 'club',
    enabled: false,
    marketPriority: ['ML'],
    profile: {
      goalEnvironment: 'low',
      homeAdvantage: 1.10,
      variance: 'low',
      fatigueSensitivity: 1.0,
      marketLiquidity: 'low'
    },
    marketSuitability: { AH: false, OU: false, ML: true },
    apiFootballId: 848,
    status: 'DISABLED',
    cohort: 'LIGUE2',
    minimumHistoricalMatches: 10
  }
];

export function getLeagueConfig(apiFootballId: number): LeagueConfig | null {
  return LEAGUE_REGISTRY.find(l => l.apiFootballId === apiFootballId) ?? null;
}

export function getLeagueConfigById(id: string): LeagueConfig | null {
  return LEAGUE_REGISTRY.find(l => l.id === id) ?? null;
}
