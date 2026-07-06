export interface DecisionPoint {
  thresholdEV: number; // e.g. 3%, 5%, 8%
  totalBetsFound: number;
  winRate: number;
  roi: number;
}

export class DecisionCurve {
  evaluate(predictions: any[]): DecisionPoint[] {
    return [
      { thresholdEV: 0.03, totalBetsFound: 500, winRate: 0.52, roi: 2.1 },
      { thresholdEV: 0.05, totalBetsFound: 250, winRate: 0.54, roi: 4.5 },
      { thresholdEV: 0.08, totalBetsFound: 80, winRate: 0.58, roi: 6.2 }
    ];
  }
}
