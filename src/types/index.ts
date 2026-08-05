export type MarketType = 'AH' | 'OU' | 'ML' | 'BTTS';
export type UserTier = 'free' | 'pro' | 'elite';
export type OddsFormat = 'decimal' | 'american' | 'fractional';

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  leagueSlug?: string;
  kickoff: string;
  status: 'SCHEDULED' | 'LIVE' | 'IN_PLAY' | 'FINISHED';
  minute?: number;
  homeScore?: number;
  awayScore?: number;
}

export interface OddsItem {
  bookmaker: string;
  selection: string;
  price: number;
  previousPrice?: number;
  line?: string;
  changePercent?: number; // Positive = steamed, Negative = drifted
}

export interface MatchOdds {
  matchId: string;
  market: MarketType;
  items: OddsItem[];
}

export interface Signal {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoff: string;
  marketType: MarketType;
  selection: string;
  bookmaker: string;
  odds: number;
  fairOdds: number;
  ev: number; // e.g. 8.5 for +8.5%
  confidence: number; // 0-100
  sharpMoney: number; // 0-100
  expiryTime: string;
  reason: string;
  publicMoneyPercent: number;
  isHighValue?: boolean;
  signalCategory?: 'Value' | 'Steam' | 'Drift' | 'Sharp' | 'Reverse Line';
}

export interface MarketDepth {
  matchId: string;
  market: MarketType;
  bestOdds: number;
  volumeWeightedOdds: number;
  liquidityScore: number; // 0-100
  bookmakersCount: number;
}

export interface DailyPerformance {
  date: string;
  pnl: number;
  cumulative: number;
}

export interface PerformanceStats {
  days: number;
  totalBets: number;
  winRate: number; // e.g. 58.4 for 58.4%
  cumulativePnL: number; // in units
  roi: number; // e.g. 12.8 for 12.8%
  dailyHistory: DailyPerformance[];
}
