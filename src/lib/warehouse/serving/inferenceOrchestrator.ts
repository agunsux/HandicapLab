import { FeatureVector } from './featureAssembler';
import { CalibrationEngine } from '../metadata/mlTraining';

export interface ModelPrediction {
  probability: number;
  fairOdds: number;
}

export interface PredictionPayload {
  modelVersionId: string;
  datasetVersionId: string;
  fixtureId: bigint;
  market: string;
  selection: string;
  predictedProbability: number;
  fairOdds: number;
  bookmakerOdds: number;
  expectedValue: number;
  kellyFraction: number;
  stakeRecommendation: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  predictionTimestamp: string;
  latencyMs: number;
  featureVersion: string;
  lineVersion: string;
  reasonCode: string;
  jsonExplanation: Record<string, any>;
  predictionHash: string;
}

export class InferenceOrchestrator {
  /**
   * Run Platt Calibration on raw prediction probability and returns odds splits.
   */
  public async predict(
    modelType: 'poisson' | 'logistic_regression' | 'lightgbm',
    vector: FeatureVector,
    bookmakerOdds: number
  ): Promise<ModelPrediction> {
    let rawProb = 0.5;

    // Simulate simple model inference arithmetic based on features
    if (modelType === 'poisson') {
      const avg = vector.features['team_rolling_avg_goals'] || 1.5;
      rawProb = avg > 2.0 ? 0.65 : 0.48;
    } else {
      rawProb = 0.52;
    }

    // Apply calibration (Platt Scaling)
    const calibratedProb = CalibrationEngine.plattScale(rawProb, -1.0, 0.0);
    const fairOdds = Number((1 / calibratedProb).toFixed(2));

    return {
      probability: Number(calibratedProb.toFixed(4)),
      fairOdds
    };
  }

  /**
   * Helper to compute Kelly stakeholders fractional allocation.
   */
  public computeKellyStake(
    probability: number,
    odds: number,
    fractional = 0.5,
    bankroll = 1000.0
  ): { fraction: number; stake: number; expectedValue: number } {
    if (odds <= 1.0) return { fraction: 0, stake: 0, expectedValue: 0 };

    const b = odds - 1;
    const q = 1 - probability;
    const fraction = (probability * b - q) / b;

    const finalFraction = Math.max(0, fraction) * fractional;
    const stake = finalFraction * bankroll;
    const expectedValue = (probability * odds) - 1.0;

    return {
      fraction: Number(finalFraction.toFixed(4)),
      stake: Number(stake.toFixed(2)),
      expectedValue: Number(expectedValue.toFixed(4))
    };
  }
}
