export interface ProbabilityPrediction {
  homeWin: number;
  draw: number;
  awayWin: number;
}

export interface ExpectedGoals {
  home: number;
  away: number;
}

export interface StandardPredictionOutput {
  fixtureId: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  prediction: ProbabilityPrediction;
  expectedGoals: ExpectedGoals;
  model: string;
  confidenceScore?: number;
  createdAt: string;
}

export interface PredictionProvider {
  /**
   * Generates a prediction for a given fixture based on historical data.
   */
  predictMatch(input: any): Promise<StandardPredictionOutput>;
}
