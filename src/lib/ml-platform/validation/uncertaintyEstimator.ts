export interface PredictionUncertainty {
  predictionId: string;
  predictedOutcome: number;
  probability: number;
  confidence: number;
  uncertainty: number; // e.g. Entropy or variance from ensemble
  confidenceInterval: [number, number];
}

export class UncertaintyEstimator {
  estimate(predictions: any[]): PredictionUncertainty[] {
    return predictions.map(p => ({
      predictionId: p.id || 'unknown',
      predictedOutcome: p.outcome,
      probability: p.probability,
      confidence: Math.abs(p.probability - 0.5) * 2, // simple proxy
      uncertainty: 1 - Math.abs(p.probability - 0.5) * 2,
      confidenceInterval: [
        Math.max(0, p.probability - 0.05),
        Math.min(1, p.probability + 0.05)
      ]
    }));
  }
}
