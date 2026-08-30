export type CanonicalMarket = 'AH' | 'OU' | 'BTTS';
export type MarketType = 'asian_handicap' | 'over_under' | 'btts';
export type OddsFormat = 'decimal' | 'american' | 'fractional';
export type SignalType = 'value' | 'steam' | 'drift' | 'reverse_line' | 'sharp';
export type UserTier = 'free' | 'pro' | 'elite';
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'HALFTIME' | 'FINISHED' | 'POSTPONED';

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  country: string;
  kickoff: string; // ISO datetime
  status: MatchStatus;
  score?: { home: number; away: number };
  minute?: number;
}

export interface MatchOdds {
  matchId: string;
  bookmaker: string;
  market: MarketType;
  selection: string;
  odds: number;
  line?: number;
  volume?: number;
  timestamp: string;
  previousOdds?: number;
  changePercent?: number;
  items?: any[]; // Backwards compatibility for UI table views
}

export interface Signal {
  id: string;
  matchId: string;
  type: SignalType;
  market: MarketType;
  selection: string;
  confidence: number; // 0-100
  ev: number; // expected value %
  odds: number;
  fairOdds: number;
  edge: number;
  bookmaker: string;
  timestamp: string;
  expiresAt: string;
  reason: string;
  sharpMoneyIndicator?: number;
  sharpMoney?: number;
  expiryTime?: string;
  lineMovement?: 'steam' | 'drift' | 'stable';
  publicMoneyPercent?: number;
  // Compatibility properties for UI display
  homeTeam?: string;
  awayTeam?: string;
  league?: string;
  kickoff?: string;
  marketType?: string;
  signalCategory?: string;
  isHighValue?: boolean;
}

export interface MarketDepth {
  matchId: string;
  market: MarketType;
  selections: {
    name: string;
    bestOdds: number;
    bookmaker: string;
    volumeWeightedOdds: number;
    liquidityScore: number;
  }[];
}

export interface PerformanceStats {
  days?: number;
  date?: string;
  profit?: number;
  cumulative?: number;
  bets?: number;
  winRate?: number;
  totalBets?: number;
  cumulativePnL?: number;
  roi?: number;
  dailyHistory?: { date: string; pnl: number; cumulative: number }[];
}

export interface UserProfile {
  tier: UserTier;
  credits: number;
  watchlist: string[];
  alertsEnabled: boolean;
  preferredMarkets: MarketType[];
  preferredOddsFormat: OddsFormat;
}
