export interface EnginePrediction {
  engineName: string;
  probability: number;
}

export class EnsembleAgreement {
  /**
   * Scaffolding for evaluating agreement across multiple internal models/engines
   * (e.g., Dixon-Coles, Poisson, XGBoost).
   */
  static evaluate(predictions: EnginePrediction[]): { mean: number; variance: number; agreementScore: number; entropy: number } {
    if (predictions.length === 0) return { mean: 0, variance: 0, agreementScore: 1, entropy: 0 };
    if (predictions.length === 1) return { mean: predictions[0].probability, variance: 0, agreementScore: 1, entropy: 0 };

    const probs = predictions.map(p => p.probability);
    const mean = probs.reduce((a, b) => a + b, 0) / probs.length;
    const variance = probs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / probs.length;
    
    // High variance means low agreement. Max variance for prob [0,1] is 0.25 (e.g., 0.5 and 0.5 or 0 and 1)
    // Normalized variance relative to max possible
    const agreementScore = Math.max(0, 1 - (variance / 0.25));

    // Simple entropy calculation over binary probabilities
    const entropy = probs.reduce((acc, p) => {
      const p1 = Math.max(0.0001, Math.min(0.9999, p));
      return acc - (p1 * Math.log2(p1) + (1 - p1) * Math.log2(1 - p1));
    }, 0) / probs.length;

    return { mean, variance, agreementScore, entropy };
  }
}
