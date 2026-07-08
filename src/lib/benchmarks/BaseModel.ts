export interface PredictionVector {
  pHome: number;
  pDraw: number;
  pAway: number;
}

export interface IBenchmarkModel {
  name: string;
  
  /**
   * Predicts the 1X2 probabilities for a match.
   * If the model requires historical data, it should fetch strictly before matchDate.
   */
  predict(match: any, context?: any): Promise<PredictionVector | null>;
}
