export interface BacktestConfig {
  league: string;
  season: number;
  dateRange: { start: string; end: string };
  market: string;
  minimumEV: number;
  minimumProbability: number;
  minimumOdds: number;
  maximumOdds: number;
  bankroll: number;
  stakeStrategy: 'FLAT' | 'KELLY';
  kellyFraction: number;
  commission: number;
  currency: string;
  randomSeed: number;
  modelVersion: string;
}

export interface IStakeStrategy {
  getName(): string;
  calculateStake(odds: number, probability: number, bankroll: number, config: BacktestConfig): number;
}

export interface BacktestEvent {
  type: 'OddsSnapshotArrived' | 'PredictionGenerated' | 'BetPlaced' | 'SettlementCompleted' | 'BankrollUpdated';
  timestamp: string;
  payload: any;
}
