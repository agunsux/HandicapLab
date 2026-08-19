// Shared types for the homepage intelligence backtest engine.

export type BacktestMarket = 'ML' | 'AH' | 'OU' | 'BTTS';

// Row shape from public.historical_matches
export interface GoldMatch {
  canonical_id: string;
  league_id: string;
  cluster: string;
  season: string;
  match_date: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  result: 'H' | 'D' | 'A';
  total_goals: number;
  home_win: boolean;
  draw: boolean;
  away_win: boolean;
  btts: boolean;
  over25: boolean;
  under25: boolean;
}

// Row shape from public.historical_odds
export interface GoldOdds {
  odds_id: string;
  canonical_id: string;
  market: 'ML' | 'AH' | 'OU';
  observation: 'opening' | 'closing';
  bookmaker_source: string;
  line: number | null;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  over_odds: number | null;
  under_odds: number | null;
}

// Per-match market odds (opening + closing from Pinnacle)
export interface MarketOddsPair {
  market: 'ML' | 'AH' | 'OU';
  line: number | null;
  opening: {
    home?: number;
    draw?: number;
    away?: number;
    over?: number;
    under?: number;
  };
  closing: {
    home?: number;
    draw?: number;
    away?: number;
    over?: number;
    under?: number;
  };
}

// A single settled backtest bet
export interface BacktestBet {
  matchDate: string;
  leagueId: string;
  season: string;
  market: BacktestMarket;
  selection: 'home' | 'draw' | 'away' | 'over' | 'under' | 'btts_yes' | 'btts_no';
  line: number | null;
  entryOdds: number;
  closingOdds: number | null;
  modelProb: number;
  edgePct: number;
  evPct: number;
  confidence: number;
  outcome: 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS';
  profitUnits: number;
  cumulativeProfit: number;
}

export interface MarketResultRow {
  market: BacktestMarket;
  totalBets: number;
  winRate: number | null;
  profitUnits: number;
  roiPct: number | null;
  avgClvPct: number | null;
  brierScore: number | null;
  avgEdgePct: number | null;
  avgEvPct: number | null;
}

export interface LeagueResultRow {
  leagueId: string;
  totalBets: number;
  winRate: number | null;
  profitUnits: number;
  roiPct: number | null;
}

export interface SeasonResultRow {
  season: string;
  totalBets: number;
  winRate: number | null;
  profitUnits: number;
  roiPct: number | null;
}

export interface CalibrationRow {
  bucketLabel: string;
  bucketLow: number;
  bucketHigh: number;
  modelProbability: number;
  actualWinRate: number;
  sampleCount: number;
}

export interface BacktestRunResult {
  status: 'READY' | 'COMPLETE' | 'BLOCKED' | 'RUNNING';
  datasetVersion: string;
  datasetHash: string | null;
  modelVersion: string;
  backtestVersion: string;
  windowStart: string;
  windowEnd: string;
  methodology: string;
  matchesTested: number;
  totalBets: number;
  winRate: number | null;
  profitUnits: number;
  roiPct: number | null;
  avgEvPct: number | null;
  avgClvPct: number | null;
  brierScore: number | null;
  logLoss: number | null;
  maxDrawdown: number | null;
  avgOdds: number | null;
  stakeUnits: number;
  ci95Low: number | null;
  ci95High: number | null;
  markets: MarketResultRow[];
  leagues: LeagueResultRow[];
  seasons: SeasonResultRow[];
  calibration: CalibrationRow[];
  distributionSanity: {
    check1: { pass: boolean; p5: number; p95: number };
    check2: { pass: boolean; meanBtts: number };
    check3: { pass: boolean; fracAbove75: number };
    overall: boolean;
  };
  blockedReason?: string;
}