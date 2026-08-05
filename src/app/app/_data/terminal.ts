// Canonical Types for Terminal UI
export type MarketType = 'asian_handicap' | 'over_under' | 'moneyline' | 'btts' | 'AH' | 'OU' | 'ML' | 'BTTS';

export interface LineMovementPoint {
  label: string;
  odds: number;
}

export interface LineMovement {
  opening: number;
  current: number;
  points: LineMovementPoint[];
}

export interface ValueBet {
  id: string;
  match: string;
  homeTeam?: string;
  awayTeam?: string;
  competition?: string;
  league: string;
  kickoff: string;
  market: MarketType;
  selection: string;
  line?: number | string;
  modelProb?: number;
  modelProbability?: number;
  marketOdds?: number;
  fairOdds?: number;
  ev?: number;
  edge?: number;
  kellyStake?: number;
  clvProjection?: number;
  sampleSize?: number;
  historicalWinRate?: number;
  historicalRoi?: number;
  driver?: string;
  modelVersion?: string;
  brier?: number;
  locked?: boolean;
  lineMovement?: LineMovement;
}

export const MARKET_LABELS: Record<string, string> = {
  asian_handicap: 'Asian Handicap',
  over_under: 'Over / Under',
  moneyline: 'Moneyline',
  btts: 'Both Teams To Score',
  AH: 'Asian Handicap',
  OU: 'Over / Under',
  ML: 'Moneyline',
  BTTS: 'Both Teams To Score',
};

export function formatKickoff(isoString: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

// Deprecated mock array permanently emptied for Stage 3 Live Coherence
export const DEMO_VALUE_BETS: ValueBet[] = [];