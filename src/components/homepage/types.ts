// Shared types for the homepage intelligence dashboard.

export interface HistoricalSummary {
  matches: number | null;
  bets: number | null;
  winRate: number | null;
  roi: number | null;
  clv: number | null;
  brierScore: number | null;
  logLoss: number | null;
  maxDrawdown: number | null;
}

export interface MarketResult {
  market: string;
  totalBets: number;
  winRate: number | null;
  roiPct: number | null;
  avgClvPct: number | null;
  brierScore: number | null;
}

export interface Opportunity {
  fixtureId: string;
  competition: string;
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  line: number | null;
  bookmaker: string;
  odds: number;
  modelProbability: number;
  fairOdds: number;
  edge: number;
  ev: number;
  grade: 'A' | 'B' | 'C' | null;
  oddsTimestamp: string | null;
  signal: string;
  stale: boolean;
}

export interface UpcomingFixtureItem {
  fixtureId: string;
  competition: string;
  season: string;
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  status: 'VALUE_FOUND' | 'MODELABLE_NO_VALUE' | 'MODEL_PENDING' | 'NO_ODDS' | 'STALE';
  statusLabel: string;
  bestEv: number | null;
  bestMarket: string | null;
  marketCount: number;
  hasOdds: boolean;
  hasModel: boolean;
}

export interface LiveFixtureSummary {
  total: number;
  modelable: number;
  withOdds: number;
  withValue: number;
  strongValue: number;
  noOdds: number;
  noPositiveEv: number;
}

export interface HomepageData {
  generatedAt: string;
  historical: {
    status: string;
    datasetVersion: string | null;
    modelVersion: string | null;
    methodology?: string;
    summary: HistoricalSummary | null;
    markets: MarketResult[];
    blockedReason?: string;
  };
  live: {
    state: string;
    fixtures: LiveFixtureSummary;
    opportunities: Opportunity[];
    upcomingFixtures?: UpcomingFixtureItem[];
    lastOddsUpdate: string | null;
  };
}