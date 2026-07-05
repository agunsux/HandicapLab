import * as crypto from 'crypto';
import { supabase } from '@/lib/supabase.server';
import { PredictionPayload } from './inferenceOrchestrator';

export class PredictionStore {
  /**
   * Generates a unique SHA-256 hash checksum for a prediction record to prevent duplicates.
   */
  public generateHash(payload: Omit<PredictionPayload, 'predictionHash'>): string {
    const raw = `${payload.modelVersionId}-${payload.fixtureId}-${payload.market}-${payload.selection}-${payload.predictionTimestamp}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Appends an immutable prediction record into the warehouse predictions registry.
   */
  public async append(payload: PredictionPayload): Promise<void> {
    const dbPayload = {
      model_version_id: payload.modelVersionId,
      dataset_version_id: payload.datasetVersionId,
      fixture_id: Number(payload.fixtureId),
      market: payload.market,
      selection: payload.selection,
      predicted_probability: payload.predictedProbability,
      fair_odds: payload.fairOdds,
      bookmaker_odds: payload.bookmakerOdds,
      expected_value: payload.expectedValue,
      kelly_fraction: payload.kellyFraction,
      stake_recommendation: payload.stakeRecommendation,
      confidence_level: payload.confidenceLevel,
      prediction_timestamp: payload.predictionTimestamp,
      latency_ms: payload.latencyMs,
      feature_version: payload.featureVersion,
      line_version: payload.lineVersion,
      reason_code: payload.reasonCode,
      json_explanation: payload.jsonExplanation,
      prediction_hash: payload.predictionHash
    };

    const { error } = await supabase.from('wh_predictions').insert(dbPayload);
    
    if (error) {
      // Catch unique constraint violation (duplicate writes)
      if (error.message.includes('unique_constraint') || error.message.includes('prediction_hash')) {
        console.warn(`[PredictionStore] Duplicate prediction detected. Skipping write for hash: ${payload.predictionHash}`);
        return;
      }
      throw new Error(`[PredictionStore] Failed to write prediction record: ${error.message}`);
    }
  }
}
