export type MarketType = 'asian_handicap' | 'over_under' | 'moneyline' | 'btts';

export interface LinePoint {
  label: string;
  odds: number;
}

export interface ValueBet {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string;
  market: MarketType;
  selection: string;
  line: string;
  modelProbability: number;
  marketOdds: number;
  fairOdds: number;
  ev: number;
  edge: number;
  clvProjection: number;
  brier: number;
  kellyStake: number;
  sampleSize: number;
  historicalWinRate: number;
  historicalRoi: number;
  lineMovement: {
    opening: number;
    current: number;
    points: LinePoint[];
  };
  driver: string;
  modelVersion: string;
}

export const MARKET_LABELS: Record<MarketType, string> = {
  asian_handicap: 'Asian Handicap',
  over_under: 'Over / Under',
  moneyline: 'Moneyline',
  btts: 'BTTS',
};

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

export const DEMO_VALUE_BETS: ValueBet[] = [
  {
    id: 'ah-001',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League',
    kickoff: hoursFromNow(4),
    market: 'asian_handicap',
    selection: 'Arsenal -0.75',
    line: '-0.75',
    modelProbability: 0.585,
    marketOdds: 1.89,
    fairOdds: 1.71,
    ev: 5.6,
    edge: 4.3,
    clvProjection: 2.1,
    brier: 0.183,
    kellyStake: 1.4,
    sampleSize: 312,
    historicalWinRate: 58.4,
    historicalRoi: 7.9,
    lineMovement: {
      opening: 1.82,
      current: 1.89,
      points: [
        { label: '-72h', odds: 1.82 },
        { label: '-48h', odds: 1.85 },
        { label: '-24h', odds: 1.87 },
        { label: '-6h', odds: 1.89 },
      ],
    },
    driver: 'Home ELO shift +3.1, xG gap 0.42, Home advantage 0.38',
    modelVersion: 'prematch-v2.4',
  },
  {
    id: 'ou-001',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Dortmund',
    competition: 'Bundesliga',
    kickoff: hoursFromNow(6),
    market: 'over_under',
    selection: 'Over 2.5',
    line: '2.5',
    modelProbability: 0.648,
    marketOdds: 1.74,
    fairOdds: 1.54,
    ev: 4.8,
    edge: 3.5,
    clvProjection: 1.8,
    brier: 0.191,
    kellyStake: 1.1,
    sampleSize: 268,
    historicalWinRate: 62.1,
    historicalRoi: 6.4,
    lineMovement: {
      opening: 1.7,
      current: 1.74,
      points: [
        { label: '-72h', odds: 1.7 },
        { label: '-48h', odds: 1.72 },
        { label: '-24h', odds: 1.73 },
        { label: '-6h', odds: 1.74 },
      ],
    },
    driver: 'Combined xG 3.41, Opp defensive pressure index 12.4% above league avg',
    modelVersion: 'prematch-v2.4',
  },
  {
    id: 'ml-001',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    competition: 'La Liga',
    kickoff: hoursFromNow(8),
    market: 'moneyline',
    selection: 'Real Madrid',
    line: 'Home',
    modelProbability: 0.512,
    marketOdds: 2.12,
    fairOdds: 1.95,
    ev: 3.4,
    edge: 2.7,
    clvProjection: 1.2,
    brier: 0.214,
    kellyStake: 0.8,
    sampleSize: 194,
    historicalWinRate: 54.2,
    historicalRoi: 4.6,
    lineMovement: {
      opening: 2.2,
      current: 2.12,
      points: [
        { label: '-72h', odds: 2.2 },
        { label: '-48h', odds: 2.18 },
        { label: '-24h', odds: 2.15 },
        { label: '-6h', odds: 2.12 },
      ],
    },
    driver: 'Home ELO shift +0.8, Clasico home form 6W-2D-1L, Rest advantage +1 day',
    modelVersion: 'prematch-v2.4',
  },
  {
    id: 'btts-001',
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester City',
    competition: 'Premier League',
    kickoff: hoursFromNow(10),
    market: 'btts',
    selection: 'BTTS Yes',
    line: 'Yes',
    modelProbability: 0.672,
    marketOdds: 1.61,
    fairOdds: 1.49,
    ev: 3.1,
    edge: 2.3,
    clvProjection: 1.0,
    brier: 0.201,
    kellyStake: 0.7,
    sampleSize: 221,
    historicalWinRate: 66.8,
    historicalRoi: 4.1,
    lineMovement: {
      opening: 1.58,
      current: 1.61,
      points: [
        { label: '-72h', odds: 1.58 },
        { label: '-48h', odds: 1.59 },
        { label: '-24h', odds: 1.6 },
        { label: '-6h', odds: 1.61 },
      ],
    },
    driver: 'Head-to-head BTTS rate 71%, both defenses conceding 1.3+ xG away',
    modelVersion: 'prematch-v2.4',
  },
  {
    id: 'ah-002',
    homeTeam: 'Inter',
    awayTeam: 'AC Milan',
    competition: 'Serie A',
    kickoff: hoursFromNow(12),
    market: 'asian_handicap',
    selection: 'Inter -0.5',
    line: '-0.5',
    modelProbability: 0.538,
    marketOdds: 1.96,
    fairOdds: 1.82,
    ev: 4.1,
    edge: 3.2,
    clvProjection: 1.5,
    brier: 0.198,
    kellyStake: 1.0,
    sampleSize: 256,
    historicalWinRate: 55.8,
    historicalRoi: 5.8,
    lineMovement: {
      opening: 1.92,
      current: 1.96,
      points: [
        { label: '-72h', odds: 1.92 },
        { label: '-48h', odds: 1.94 },
        { label: '-24h', odds: 1.95 },
        { label: '-6h', odds: 1.96 },
      ],
    },
    driver: 'Milan away xG conceded 1.5+/game last 8, Inter home win streak 5',
    modelVersion: 'prematch-v2.4',
  },
  {
    id: 'ou-002',
    homeTeam: 'PSV',
    awayTeam: 'Ajax',
    competition: 'Eredivisie',
    kickoff: hoursFromNow(14),
    market: 'over_under',
    selection: 'Over 3.0',
    line: '3.0',
    modelProbability: 0.591,
    marketOdds: 1.98,
    fairOdds: 1.69,
    ev: 6.2,
    edge: 4.8,
    clvProjection: 2.4,
    brier: 0.188,
    kellyStake: 1.6,
    sampleSize: 178,
    historicalWinRate: 60.5,
    historicalRoi: 8.6,
    lineMovement: {
      opening: 1.9,
      current: 1.98,
      points: [
        { label: '-72h', odds: 1.9 },
        { label: '-48h', odds: 1.93 },
        { label: '-24h', odds: 1.96 },
        { label: '-6h', odds: 1.98 },
      ],
    },
    driver: 'De Klassieker avg 3.7 goals, xG sum 3.6, early-season high press both sides',
    modelVersion: 'prematch-v2.4',
  },
  {
    id: 'ml-002',
    homeTeam: 'Juventus',
    awayTeam: 'Napoli',
    competition: 'Serie A',
    kickoff: hoursFromNow(16),
    market: 'moneyline',
    selection: 'Draw',
    line: 'Draw',
    modelProbability: 0.278,
    marketOdds: 3.7,
    fairOdds: 3.58,
    ev: 2.8,
    edge: 2.1,
    clvProjection: 0.9,
    brier: 0.221,
    kellyStake: 0.5,
    sampleSize: 142,
    historicalWinRate: 27.4,
    historicalRoi: 3.2,
    lineMovement: {
      opening: 3.8,
      current: 3.7,
      points: [
        { label: '-72h', odds: 3.8 },
        { label: '-48h', odds: 3.75 },
        { label: '-24h', odds: 3.72 },
        { label: '-6h', odds: 3.7 },
      ],
    },
    driver: 'Low-scoring matchup xG spread 0.18, Juve draw rate at home 32%',
    modelVersion: 'prematch-v2.4',
  },
  {
    id: 'btts-002',
    homeTeam: 'Tottenham',
    awayTeam: 'Newcastle',
    competition: 'Premier League',
    kickoff: hoursFromNow(20),
    market: 'btts',
    selection: 'BTTS Yes',
    line: 'Yes',
    modelProbability: 0.654,
    marketOdds: 1.67,
    fairOdds: 1.53,
    ev: 4.4,
    edge: 3.3,
    clvProjection: 1.6,
    brier: 0.196,
    kellyStake: 1.1,
    sampleSize: 203,
    historicalWinRate: 64.2,
    historicalRoi: 5.5,
    lineMovement: {
      opening: 1.63,
      current: 1.67,
      points: [
        { label: '-72h', odds: 1.63 },
        { label: '-48h', odds: 1.65 },
        { label: '-24h', odds: 1.66 },
        { label: '-6h', odds: 1.67 },
      ],
    },
    driver: 'Both teams top-5 shots volume, Spurs concede 1.6 xG at home',
    modelVersion: 'prematch-v2.4',
  },
  {
    id: 'ah-003',
    homeTeam: 'Lille',
    awayTeam: 'Monaco',
    competition: 'Ligue 1',
    kickoff: hoursFromNow(24),
    market: 'asian_handicap',
    selection: 'Lille +0.25',
    line: '+0.25',
    modelProbability: 0.542,
    marketOdds: 1.88,
    fairOdds: 1.76,
    ev: 3.6,
    edge: 2.8,
    clvProjection: 1.3,
    brier: 0.205,
    kellyStake: 0.9,
    sampleSize: 167,
    historicalWinRate: 56.9,
    historicalRoi: 4.9,
    lineMovement: {
      opening: 1.84,
      current: 1.88,
      points: [
        { label: '-72h', odds: 1.84 },
        { label: '-48h', odds: 1.86 },
        { label: '-24h', odds: 1.87 },
        { label: '-6h', odds: 1.88 },
      ],
    },
    driver: 'Monaco away xG 0.9 underperforms market, Lille unbeaten at home 7',
    modelVersion: 'prematch-v2.4',
  },
  {
    id: 'ou-003',
    homeTeam: 'West Ham',
    awayTeam: 'Brighton',
    competition: 'Premier League',
    kickoff: hoursFromNow(28),
    market: 'over_under',
    selection: 'Under 2.5',
    line: '2.5',
    modelProbability: 0.581,
    marketOdds: 1.79,
    fairOdds: 1.72,
    ev: 2.6,
    edge: 2.0,
    clvProjection: 0.8,
    brier: 0.209,
    kellyStake: 0.5,
    sampleSize: 189,
    historicalWinRate: 58.7,
    historicalRoi: 3.6,
    lineMovement: {
      opening: 1.76,
      current: 1.79,
      points: [
        { label: '-72h', odds: 1.76 },
        { label: '-48h', odds: 1.77 },
        { label: '-24h', odds: 1.78 },
        { label: '-6h', odds: 1.79 },
      ],
    },
    driver: 'Brighton away goals 0.9/game, West Ham under rate 61% at home',
    modelVersion: 'prematch-v2.4',
  },
];

export function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}