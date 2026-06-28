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
  footballDataId?: number;
  oddsApiSportKey?: string;
  status: CompetitionStatus;
  cohort: 'WORLD_CUP' | 'EPL' | 'LIGUE2' | 'EUROPA' | 'OTHER';
  minimumHistoricalMatches?: number;
  priority: number; // Ingestion / calculation priority: 1 (highest) to 3 (lowest)
  competition_type: 'league' | 'cup' | 'international_tournament';
  activation?: {
    start: string;
    end?: string;
  };
  tier?: number;
  liquidity_score?: number;
  market_coverage_score?: number;
}

export const LEAGUE_REGISTRY: LeagueConfig[] = [
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
    footballDataId: 2000,
    oddsApiSportKey: 'soccer_fifa_world_cup',
    status: 'ACTIVE',
    cohort: 'WORLD_CUP',
    minimumHistoricalMatches: 3,
    priority: 1,
    competition_type: 'international_tournament',
    activation: {
      start: '2026-06-11',
      end: '2026-07-19'
    },
    tier: 1,
    liquidity_score: 95,
    market_coverage_score: 100
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
      homeAdvantage: 1.08,
      variance: 'high',
      fatigueSensitivity: 1.2,
      marketLiquidity: 'high'
    },
    marketSuitability: { AH: true, OU: true, ML: true },
    apiFootballId: 2,
    footballDataId: 2001,
    status: 'ACTIVE',
    cohort: 'EUROPA',
    minimumHistoricalMatches: 5,
    priority: 1,
    competition_type: 'cup',
    tier: 1,
    liquidity_score: 95,
    market_coverage_score: 100
  },
  {
    id: 'uefa_europa_league',
    name: 'UEFA Europa League',
    country: 'Europe',
    type: 'club',
    enabled: true,
    marketPriority: ['AH', 'OU', 'ML'],
    profile: {
      goalEnvironment: 'medium',
      homeAdvantage: 1.08,
      variance: 'medium-high',
      fatigueSensitivity: 1.1,
      marketLiquidity: 'high'
    },
    marketSuitability: { AH: true, OU: true, ML: true },
    apiFootballId: 3,
    status: 'ACTIVE',
    cohort: 'EUROPA',
    minimumHistoricalMatches: 5,
    priority: 1,
    competition_type: 'cup',
    tier: 1,
    liquidity_score: 85,
    market_coverage_score: 100
  },
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
    footballDataId: 2021,
    status: 'ACTIVE',
    cohort: 'EPL',
    minimumHistoricalMatches: 10,
    priority: 2,
    competition_type: 'league',
    tier: 1,
    liquidity_score: 100,
    market_coverage_score: 100
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
    footballDataId: 2014,
    status: 'ACTIVE',
    cohort: 'OTHER',
    minimumHistoricalMatches: 10,
    priority: 2,
    competition_type: 'league',
    tier: 1,
    liquidity_score: 90,
    market_coverage_score: 100
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
    footballDataId: 2019,
    status: 'ACTIVE',
    cohort: 'OTHER',
    minimumHistoricalMatches: 10,
    priority: 2,
    competition_type: 'league',
    tier: 2,
    liquidity_score: 75,
    market_coverage_score: 100
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
    footballDataId: 2002,
    status: 'ACTIVE',
    cohort: 'OTHER',
    minimumHistoricalMatches: 10,
    priority: 2,
    competition_type: 'league',
    tier: 1,
    liquidity_score: 90,
    market_coverage_score: 100
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
    footballDataId: 2015,
    status: 'ACTIVE',
    cohort: 'OTHER',
    minimumHistoricalMatches: 10,
    priority: 2,
    competition_type: 'league',
    tier: 2,
    liquidity_score: 70,
    market_coverage_score: 100
  },
  {
    id: 'uefa_conference_league',
    name: 'UEFA Conference League',
    country: 'Europe',
    type: 'club',
    enabled: true,
    marketPriority: ['AH', 'OU', 'ML'],
    profile: {
      goalEnvironment: 'medium',
      homeAdvantage: 1.08,
      variance: 'medium',
      fatigueSensitivity: 1.0,
      marketLiquidity: 'medium'
    },
    marketSuitability: { AH: true, OU: true, ML: true },
    apiFootballId: 844,
    status: 'ACTIVE',
    cohort: 'OTHER',
    minimumHistoricalMatches: 5,
    priority: 3,
    competition_type: 'cup',
    tier: 2,
    liquidity_score: 65,
    market_coverage_score: 100
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
    minimumHistoricalMatches: 10,
    priority: 3,
    competition_type: 'league',
    tier: 3,
    liquidity_score: 30,
    market_coverage_score: 40
  }
];

export function getLeagueConfig(apiFootballId: number | string): LeagueConfig | null {
  const lookupStr = String(apiFootballId).toLowerCase();
  return LEAGUE_REGISTRY.find(l => 
    String(l.apiFootballId) === lookupStr || 
    l.id.toLowerCase() === lookupStr || 
    l.name.toLowerCase() === lookupStr
  ) ?? null;
}

export function getLeagueConfigById(id: string): LeagueConfig | null {
  return LEAGUE_REGISTRY.find(l => l.id === id) ?? null;
}
