// Benchmark Framework — Types
export type BenchmarkModelId =
  | 'CLOSING_ODDS' | 'OPENING_ODDS' | 'HOME_FAVORITE' | 'AWAY_FAVORITE'
  | 'ALWAYS_HOME' | 'ALWAYS_AWAY' | 'ALWAYS_DRAW' | 'RANDOM'
  | 'MARKET_IMPLIED' | 'FLAT_50';

export interface BenchmarkInput {
  matchId: string; modelHomeProb: number; modelDrawProb: number; modelAwayProb: number;
  oddsHome: number; oddsDraw: number; oddsAway: number;
  openingOddsHome: number; openingOddsDraw: number; openingOddsAway: number;
  outcome: 'home' | 'draw' | 'away';
  isHomeFavorite: boolean; isAwayFavorite: boolean;
}

export interface BenchmarkMetrics {
  roi: number; yield: number; accuracy: number;
  logLoss: number; brierScore: number; clv: number | null;
  expectedValue: number; calibrationError: number;
  totalBets: number; winningBets: number; totalProfit: number; totalStake: number;
}

export interface BenchmarkResult {
  modelId: BenchmarkModelId; modelName: string; metrics: BenchmarkMetrics;
}

export interface BenchmarkSuiteResult {
  datasetName: string; datasetSize: number;
  timestamp: string; seed: number;
  results: BenchmarkResult[]; ranking: BenchmarkModelId[];
}
