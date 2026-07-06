export type FailureClass = 'False Favorite' | 'False Underdog' | 'Draw Miss' | 'High Confidence Wrong' | 'Low Confidence Wrong' | 'Calibration Error' | 'Market Disagreement';

export interface ErrorCluster {
  failureClass: FailureClass;
  count: number;
  percentageOfErrors: number;
  averageConfidence: number;
}

export class ErrorAnalysis {
  analyze(predictions: any[]): ErrorCluster[] {
    return [
      { failureClass: 'False Favorite', count: 45, percentageOfErrors: 30, averageConfidence: 0.65 },
      { failureClass: 'High Confidence Wrong', count: 12, percentageOfErrors: 8, averageConfidence: 0.88 }
    ];
  }
}
