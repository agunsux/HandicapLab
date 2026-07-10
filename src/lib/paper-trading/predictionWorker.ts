// HandicapLab Prediction Worker
// Location: src/lib/paper-trading/predictionWorker.ts

import { JobRecord } from './types';
import { PredictionLedgerRepository } from '../data/predictionLedgerRepository';
import { SnapshotLocker } from './snapshotLocker';
import { EnsembleEngine } from '../engines/decision-engine-v1/ensemble-engine';
import { RecommendationEngine } from '../engines/decision-engine-v1/recommendation-engine';
import { MatchFeatures } from '../engines/feature-engine/types';
import { PredictionFeatures } from '../market-intelligence/types';

export class PredictionWorker {
  /**
   * Idempotent prediction worker that handles incoming fixture creation or kickoff events.
   */
  public static async handleFixtureEvent(job: JobRecord): Promise<void> {
    const correlationId = job.correlation_id;
    const { matchId, features, marketFeatures, marketOdds, marketSelection, marketName, kellyMultiplier } = job.payload;

    if (!matchId || !features || !marketFeatures) {
      throw new Error(`[PredictionWorker] Missing required fields (matchId, features, or marketFeatures) in payload.`);
    }

    console.log(
      `[PredictionWorker] [correlation_id=${correlationId}] Processing fixture event for match: ${matchId} | Worker: PredictionWorker`
    );

    // 1. Idempotency layer: check SnapshotLocker
    if (SnapshotLocker.has(matchId)) {
      console.log(`[PredictionWorker] Snapshot already exists for match ${matchId}. Aborting to prevent duplicates.`);
      return;
    }

    // 2. Ledger check (Single Source of Truth)
    const existing = await PredictionLedgerRepository.getPredictionsByMatchId(matchId);
    if (existing && existing.length > 0) {
      console.log(`[PredictionWorker] Prediction ledger already has records for match ${matchId}. Aborting.`);
      return;
    }

    // 3. Generate Predictions using Ensemble Engine (unchanged math/calibration)
    const ensemble = await EnsembleEngine.predict(features);

    // 4. Generate recommendations via Recommendation Engine
    const rec = RecommendationEngine.generate(
      features,
      ensemble,
      marketFeatures,
      marketOdds,
      marketSelection,
      marketName,
      kellyMultiplier || 0.25
    );

    // 5. Freeze in SnapshotLocker (Immutability Layer)
    SnapshotLocker.lock(matchId, {
      matchId,
      odds: {
        home: marketFeatures.currentOdds.home,
        draw: marketFeatures.currentOdds.draw,
        away: marketFeatures.currentOdds.away
      },
      probabilities: {
        home: ensemble.pHome,
        draw: ensemble.pDraw,
        away: ensemble.pAway
      },
      features,
      modelVersion: 'Model_v3.5',
      calibrationVersion: 'Beta'
    });

    // 5.1 Calculate Staking Details via RiskEngine
    const { RiskEngine } = await import('../engines/decision-engine-v1/risk-engine');
    const kelly = RiskEngine.calculateKellyFraction(
      rec.probability,
      marketOdds,
      kellyMultiplier || 0.25
    );

    // 6. Write to prediction ledger repository (Single Source of Truth)
    const hash = await PredictionLedgerRepository.appendPrediction({
      match_id: matchId,
      model_id: 'Model_v3.5',
      market_type: features.marketType || 'ML',
      selection: marketSelection,
      line: features.marketType === 'AH' ? (features as any).line : null,
      raw_probability: ensemble.pHome,
      calibrated_probability: rec.probability,
      market_odds: marketOdds,
      expected_value: rec.expectedValue,
      kelly_fraction: kelly.kellyFraction,
      risk_adjusted_stake: kelly.recommendedStake,
      feature_version: 'market_features_v1',
      feature_vector_snapshot: features,
      explainability_json: rec,
      prediction_timestamp: new Date().toISOString()
    });

    if (!hash) {
      throw new Error(`[PredictionWorker] Failed to write prediction to ledger.`);
    }

    console.log(
      `[PredictionWorker] [correlation_id=${correlationId}] Successfully generated prediction snapshot and ledger write for match: ${matchId} | Hash: ${hash}`
    );
  }
}
