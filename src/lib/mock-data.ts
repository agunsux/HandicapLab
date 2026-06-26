// Mock Data Store and Utilities

export interface Team {
  id: string;
  name: string;
  league: string;
  country: string;
}

export interface TeamStats {
  teamId: string;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
  last10Form: ('W' | 'D' | 'L')[];
}

export interface Match {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffTime: Date;
  league: string;
  homeTeam?: Team;
  awayTeam?: Team;
}

export interface Prediction {
  matchId: string;
  // Asian Handicap
  handicapLine: number;
  handicapProbability: number;
  handicapFairOdds: number;
  handicapMarketOdds: number;
  handicapEdgePercent: number;
  confidenceScore: number;
  
  // Over Under
  totalLine: number;
  overProbability: number;
  underProbability: number;
  ouEdgePercent: number;
  
  // Moneyline
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
}

export interface BacktestSummary {
  date: string;
  cumulativeRoi: number;
  winRate: number;
  totalBets: number;
}

// Teams
export const MOCK_TEAMS: Team[] = [
  { id: 'a21b33fa-0b5c-4be2-beab-df0eb03c0b01', name: 'Arsenal', league: 'English Premier League', country: 'England' },
  { id: 'c11b33fa-0b5c-4be2-beab-df0eb03c0b02', name: 'Chelsea', league: 'English Premier League', country: 'England' },
  { id: 'l11b33fa-0b5c-4be2-beab-df0eb03c0b03', name: 'Liverpool', league: 'English Premier League', country: 'England' },
  { id: 'm11b33fa-0b5c-4be2-beab-df0eb03c0b04', name: 'Manchester City', league: 'English Premier League', country: 'England' },
  { id: 'm21b33fa-0b5c-4be2-beab-df0eb03c0b05', name: 'Manchester United', league: 'English Premier League', country: 'England' },
  { id: 't11b33fa-0b5c-4be2-beab-df0eb03c0b06', name: 'Tottenham Hotspur', league: 'English Premier League', country: 'England' },
  { id: 'a11b33fa-0b5c-4be2-beab-df0eb03c0b07', name: 'Aston Villa', league: 'English Premier League', country: 'England' },
  { id: 'n11b33fa-0b5c-4be2-beab-df0eb03c0b08', name: 'Newcastle United', league: 'English Premier League', country: 'England' },
];

// Stats
export const MOCK_STATS: Record<string, TeamStats> = {
  'a21b33fa-0b5c-4be2-beab-df0eb03c0b01': {
    teamId: 'a21b33fa-0b5c-4be2-beab-df0eb03c0b01',
    homeGoalsFor: 2.30, homeGoalsAgainst: 0.70, awayGoalsFor: 1.95, awayGoalsAgainst: 0.90,
    last10Form: ['W', 'W', 'D', 'W', 'L', 'W', 'W', 'W', 'D', 'W']
  },
  'c11b33fa-0b5c-4be2-beab-df0eb03c0b02': {
    teamId: 'c11b33fa-0b5c-4be2-beab-df0eb03c0b02',
    homeGoalsFor: 1.80, homeGoalsAgainst: 1.20, awayGoalsFor: 1.45, awayGoalsAgainst: 1.55,
    last10Form: ['W', 'L', 'D', 'W', 'D', 'L', 'W', 'W', 'D', 'W']
  },
  'l11b33fa-0b5c-4be2-beab-df0eb03c0b03': {
    teamId: 'l11b33fa-0b5c-4be2-beab-df0eb03c0b03',
    homeGoalsFor: 2.45, homeGoalsAgainst: 0.85, awayGoalsFor: 2.10, awayGoalsAgainst: 1.05,
    last10Form: ['W', 'W', 'W', 'D', 'W', 'W', 'L', 'W', 'W', 'W']
  },
  'm11b33fa-0b5c-4be2-beab-df0eb03c0b04': {
    teamId: 'm11b33fa-0b5c-4be2-beab-df0eb03c0b04',
    homeGoalsFor: 2.75, homeGoalsAgainst: 0.90, awayGoalsFor: 2.20, awayGoalsAgainst: 1.10,
    last10Form: ['W', 'W', 'D', 'W', 'W', 'W', 'W', 'D', 'L', 'W']
  },
  'm21b33fa-0b5c-4be2-beab-df0eb03c0b05': {
    teamId: 'm21b33fa-0b5c-4be2-beab-df0eb03c0b05',
    homeGoalsFor: 1.65, homeGoalsAgainst: 1.15, awayGoalsFor: 1.30, awayGoalsAgainst: 1.40,
    last10Form: ['L', 'W', 'D', 'L', 'W', 'L', 'W', 'D', 'W', 'L']
  },
  't11b33fa-0b5c-4be2-beab-df0eb03c0b06': {
    teamId: 't11b33fa-0b5c-4be2-beab-df0eb03c0b06',
    homeGoalsFor: 2.10, homeGoalsAgainst: 1.40, awayGoalsFor: 1.70, awayGoalsAgainst: 1.65,
    last10Form: ['W', 'L', 'W', 'W', 'L', 'D', 'W', 'L', 'W', 'D']
  },
  'a11b33fa-0b5c-4be2-beab-df0eb03c0b07': {
    teamId: 'a11b33fa-0b5c-4be2-beab-df0eb03c0b07',
    homeGoalsFor: 1.95, homeGoalsAgainst: 1.10, awayGoalsFor: 1.50, awayGoalsAgainst: 1.45,
    last10Form: ['W', 'D', 'W', 'L', 'D', 'W', 'W', 'L', 'W', 'L']
  },
  'n11b33fa-0b5c-4be2-beab-df0eb03c0b08': {
    teamId: 'n11b33fa-0b5c-4be2-beab-df0eb03c0b08',
    homeGoalsFor: 2.25, homeGoalsAgainst: 1.00, awayGoalsFor: 1.35, awayGoalsAgainst: 1.60,
    last10Form: ['L', 'W', 'W', 'D', 'L', 'W', 'L', 'W', 'W', 'D']
  },
};

// Matches
const now = new Date();
export const MOCK_MATCHES: Match[] = [
  {
    id: 'e11b33fa-0b5c-4be2-beab-df0eb03c0c01',
    homeTeamId: 'l11b33fa-0b5c-4be2-beab-df0eb03c0b03', // Liverpool
    awayTeamId: 'c11b33fa-0b5c-4be2-beab-df0eb03c0b02', // Chelsea
    kickoffTime: new Date(now.getTime() + 3 * 60 * 60 * 1000), // in 3 hours
    league: 'English Premier League'
  },
  {
    id: 'e11b33fa-0b5c-4be2-beab-df0eb03c0c02',
    homeTeamId: 'm11b33fa-0b5c-4be2-beab-df0eb03c0b04', // Man City
    awayTeamId: 'm21b33fa-0b5c-4be2-beab-df0eb03c0b05', // Man United
    kickoffTime: new Date(now.getTime() + 6 * 60 * 60 * 1000), // in 6 hours
    league: 'English Premier League'
  },
  {
    id: 'e11b33fa-0b5c-4be2-beab-df0eb03c0c03',
    homeTeamId: 'a21b33fa-0b5c-4be2-beab-df0eb03c0b01', // Arsenal
    awayTeamId: 'a11b33fa-0b5c-4be2-beab-df0eb03c0b07', // Aston Villa
    kickoffTime: new Date(now.getTime() + (24 + 2) * 60 * 60 * 1000), // tomorrow
    league: 'English Premier League'
  },
  {
    id: 'e11b33fa-0b5c-4be2-beab-df0eb03c0c04',
    homeTeamId: 't11b33fa-0b5c-4be2-beab-df0eb03c0b06', // Tottenham
    awayTeamId: 'n11b33fa-0b5c-4be2-beab-df0eb03c0b08', // Newcastle
    kickoffTime: new Date(now.getTime() + (24 + 5) * 60 * 60 * 1000), // tomorrow
    league: 'English Premier League'
  },
  {
    id: 'e11b33fa-0b5c-4be2-beab-df0eb03c0c05',
    homeTeamId: 'c11b33fa-0b5c-4be2-beab-df0eb03c0b02', // Chelsea
    awayTeamId: 'm11b33fa-0b5c-4be2-beab-df0eb03c0b04', // Man City
    kickoffTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // in 3 days
    league: 'English Premier League'
  },
  {
    id: 'e11b33fa-0b5c-4be2-beab-df0eb03c0c06',
    homeTeamId: 'm21b33fa-0b5c-4be2-beab-df0eb03c0b05', // Man United
    awayTeamId: 'l11b33fa-0b5c-4be2-beab-df0eb03c0b03', // Liverpool
    kickoffTime: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), // in 4 days
    league: 'English Premier League'
  }
];

// Predictions map
export const MOCK_PREDICTIONS: Record<string, Prediction> = {
  // Liverpool vs Chelsea
  'e11b33fa-0b5c-4be2-beab-df0eb03c0c01': {
    matchId: 'e11b33fa-0b5c-4be2-beab-df0eb03c0c01',
    handicapLine: -0.25,
    handicapProbability: 0.58,
    handicapFairOdds: 1.72,
    handicapMarketOdds: 1.95,
    handicapEdgePercent: 13.30,
    confidenceScore: 82,
    totalLine: 2.5,
    overProbability: 0.67,
    underProbability: 0.33,
    ouEdgePercent: 6.4,
    homeProbability: 0.55,
    drawProbability: 0.25,
    awayProbability: 0.20
  },
  // Man City vs Man United
  'e11b33fa-0b5c-4be2-beab-df0eb03c0c02': {
    matchId: 'e11b33fa-0b5c-4be2-beab-df0eb03c0c02',
    handicapLine: -1.25,
    handicapProbability: 0.61,
    handicapFairOdds: 1.64,
    handicapMarketOdds: 1.85,
    handicapEdgePercent: 12.80,
    confidenceScore: 88,
    totalLine: 3.0,
    overProbability: 0.62,
    underProbability: 0.38,
    ouEdgePercent: 4.2,
    homeProbability: 0.68,
    drawProbability: 0.18,
    awayProbability: 0.14
  },
  // Arsenal vs Aston Villa
  'e11b33fa-0b5c-4be2-beab-df0eb03c0c03': {
    matchId: 'e11b33fa-0b5c-4be2-beab-df0eb03c0c03',
    handicapLine: -0.75,
    handicapProbability: 0.54,
    handicapFairOdds: 1.85,
    handicapMarketOdds: 1.91,
    handicapEdgePercent: 3.20,
    confidenceScore: 75,
    totalLine: 2.5,
    overProbability: 0.59,
    underProbability: 0.41,
    ouEdgePercent: 1.8,
    homeProbability: 0.52,
    drawProbability: 0.26,
    awayProbability: 0.22
  },
  // Tottenham vs Newcastle
  'e11b33fa-0b5c-4be2-beab-df0eb03c0c04': {
    matchId: 'e11b33fa-0b5c-4be2-beab-df0eb03c0c04',
    handicapLine: -0.25,
    handicapProbability: 0.51,
    handicapFairOdds: 1.96,
    handicapMarketOdds: 2.10,
    handicapEdgePercent: 7.10,
    confidenceScore: 78,
    totalLine: 3.0,
    overProbability: 0.69,
    underProbability: 0.31,
    ouEdgePercent: 8.5,
    homeProbability: 0.45,
    drawProbability: 0.24,
    awayProbability: 0.31
  },
  // Chelsea vs Man City
  'e11b33fa-0b5c-4be2-beab-df0eb03c0c05': {
    matchId: 'e11b33fa-0b5c-4be2-beab-df0eb03c0c05',
    handicapLine: -0.50,
    handicapProbability: 0.57,
    handicapFairOdds: 1.75,
    handicapMarketOdds: 1.90,
    handicapEdgePercent: 8.60,
    confidenceScore: 81,
    totalLine: 2.5,
    overProbability: 0.46,
    underProbability: 0.54,
    ouEdgePercent: 5.1,
    homeProbability: 0.28,
    drawProbability: 0.27,
    awayProbability: 0.45
  },
  // Man United vs Liverpool
  'e11b33fa-0b5c-4be2-beab-df0eb03c0c06': {
    matchId: 'e11b33fa-0b5c-4be2-beab-df0eb03c0c06',
    handicapLine: -0.50,
    handicapProbability: 0.59,
    handicapFairOdds: 1.69,
    handicapMarketOdds: 1.87,
    handicapEdgePercent: 10.70,
    confidenceScore: 84,
    totalLine: 2.5,
    overProbability: 0.64,
    underProbability: 0.36,
    ouEdgePercent: 5.8,
    homeProbability: 0.24,
    drawProbability: 0.25,
    awayProbability: 0.51
  }
};

// Backtest Performance (Cumulative history)
export const MOCK_BACKTEST_HISTORY: BacktestSummary[] = [
  { date: 'May 01', cumulativeRoi: 0.0, winRate: 0.0, totalBets: 0 },
  { date: 'May 05', cumulativeRoi: 2.4, winRate: 54.2, totalBets: 12 },
  { date: 'May 10', cumulativeRoi: 5.1, winRate: 56.8, totalBets: 28 },
  { date: 'May 15', cumulativeRoi: 4.8, winRate: 55.1, totalBets: 41 },
  { date: 'May 20', cumulativeRoi: 7.2, winRate: 57.3, totalBets: 55 },
  { date: 'May 25', cumulativeRoi: 9.5, winRate: 59.1, totalBets: 70 },
  { date: 'May 30', cumulativeRoi: 8.9, winRate: 58.0, totalBets: 86 },
  { date: 'Jun 05', cumulativeRoi: 11.2, winRate: 58.7, totalBets: 102 },
  { date: 'Jun 10', cumulativeRoi: 10.4, winRate: 57.9, totalBets: 119 },
  { date: 'Jun 15', cumulativeRoi: 13.8, winRate: 59.4, totalBets: 134 },
  { date: 'Jun 20', cumulativeRoi: 14.7, winRate: 60.1, totalBets: 145 },
];

// Helper to populate teams inside match objects
function populateMatch(match: Match): Match {
  const homeTeam = MOCK_TEAMS.find((t) => t.id === match.homeTeamId);
  const awayTeam = MOCK_TEAMS.find((t) => t.id === match.awayTeamId);
  return {
    ...match,
    homeTeam,
    awayTeam,
  };
}

export function getMatches(): Match[] {
  if (process.env.NODE_ENV === 'production') {
    return [];
  }
  return MOCK_MATCHES.map(populateMatch);
}

export function getMatchById(id: string): Match | undefined {
  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }
  const match = MOCK_MATCHES.find((m) => m.id === id);
  if (!match) return undefined;
  return populateMatch(match);
}

export function getTodayMatches(): Match[] {
  if (process.env.NODE_ENV === 'production') {
    return [];
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return MOCK_MATCHES.filter(
    (m) => m.kickoffTime >= startOfToday && m.kickoffTime < endOfToday
  ).map(populateMatch);
}

export function getTeams(): Team[] {
  if (process.env.NODE_ENV === 'production') {
    return [];
  }
  return MOCK_TEAMS;
}

export function getTeamStats(teamId: string): TeamStats | undefined {
  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }
  return MOCK_STATS[teamId];
}

export function getPredictionsForMatch(matchId: string): Prediction | undefined {
  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }
  return MOCK_PREDICTIONS[matchId];
}

export function getBacktestHistory(): BacktestSummary[] {
  if (process.env.NODE_ENV === 'production') {
    return [];
  }
  return MOCK_BACKTEST_HISTORY;
}
