// Immutable Prediction Ledger v3 Repository
// Location: src/lib/data/predictionLedgerRepository.ts

import { supabase } from '../supabase.server';
import crypto from 'crypto';

export interface PredictionLedgerV3Record {
  id?: string;
  prediction_hash?: string;
  prior_hash?: string | null;
  match_id: string;
  model_id: string;
  market_type: string;
  selection: string;
  line?: number | null;
  raw_probability: number;
  calibrated_probability: number;
  market_odds: number;
  expected_value: number;
  kelly_fraction: number;
  risk_adjusted_stake: number;
  feature_version: string;
  feature_vector_snapshot: any;
  explainability_json: any;
  prediction_timestamp: string;
}

export interface PredictionSettlementV3Record {
  id?: string;
  prediction_hash: string;
  status: 'won' | 'lost' | 'void' | 'half_won' | 'half_lost';
  profit_loss: number;
  closing_odds: number;
  actual_clv: number;
  brier_contribution: number;
  logloss_contribution: number;
}

export class PredictionLedgerRepository {
  /**
   * Retrieves the latest entry from the prediction ledger to get the prior hash.
   */
  public static async getLatestLedgerEntry(): Promise<string | null> {
    const { data, error } = await supabase
      .from('prediction_ledger_v3')
      .select('prediction_hash')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data.prediction_hash;
  }

  /**
   * Appends an immutable prediction to the ledger.
   * Generates a SHA-256 fingerprint hash of inputs, features, and the prior hash.
   */
  public static async appendPrediction(
    record: Omit<PredictionLedgerV3Record, 'prediction_hash' | 'prior_hash'>
  ): Promise<string | null> {
    const priorHash = await this.getLatestLedgerEntry();

    const hashInput = JSON.stringify({
      match_id: record.match_id,
      model_id: record.model_id,
      market_type: record.market_type,
      selection: record.selection,
      raw_probability: record.raw_probability,
      calibrated_probability: record.calibrated_probability,
      feature_vector_snapshot: record.feature_vector_snapshot,
      prior_hash: priorHash
    });

    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

    const { error } = await supabase.from('prediction_ledger_v3').insert({
      ...record,
      prediction_hash: hash,
      prior_hash: priorHash
    });

    if (error) {
      console.error('[PredictionLedgerRepository] appendPrediction error:', error.message);
      return null;
    }

    return hash;
  }

  /**
   * Settles a prediction.
   * Appends a settlement record to the ledger settlements table referencing the prediction hash.
   */
  public static async settlePrediction(settlement: PredictionSettlementV3Record): Promise<boolean> {
    const { error } = await supabase.from('prediction_settlements_v3').insert({
      prediction_hash: settlement.prediction_hash,
      status: settlement.status,
      profit_loss: settlement.profit_loss,
      closing_odds: settlement.closing_odds,
      actual_clv: settlement.actual_clv,
      brier_contribution: settlement.brier_contribution,
      logloss_contribution: settlement.logloss_contribution
    });

    if (error) {
      console.error('[PredictionLedgerRepository] settlePrediction error:', error.message);
      return false;
    }
    return true;
  }

  /**
   * Retrieves prediction details by its cryptographic hash.
   */
  public static async getPredictionByHash(hash: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('prediction_ledger_v3')
      .select(`
        *,
        prediction_settlements_v3 (
          status,
          profit_loss,
          closing_odds,
          actual_clv,
          brier_contribution,
          logloss_contribution,
          settled_at
        )
      `)
      .eq('prediction_hash', hash)
      .maybeSingle();

    if (error) {
      console.error('[PredictionLedgerRepository] getPredictionByHash error:', error.message);
      return null;
    }
    return data;
  }
}
