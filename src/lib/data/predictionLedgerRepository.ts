// Immutable Prediction Ledger v3 Repository
// Location: src/lib/data/predictionLedgerRepository.ts

import { supabase } from '../supabase.server';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

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
  feature_vector_snapshot: Record<string, any>;
  explainability_json: Record<string, any>;
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
  private static localLedgerPath = path.join(
    'C:', 'Users', 'RYZEN', '.gemini', 'antigravity-ide', 'brain', 
    'b0e51ad4-db7e-4196-9e0e-e58ff37caeeb', 'artifacts', 'prediction_ledger_v3.json'
  );

  private static localSettlementsPath = path.join(
    'C:', 'Users', 'RYZEN', '.gemini', 'antigravity-ide', 'brain', 
    'b0e51ad4-db7e-4196-9e0e-e58ff37caeeb', 'artifacts', 'prediction_settlements_v3.json'
  );

  private static loadLocalLedger(): PredictionLedgerV3Record[] {
    try {
      if (fs.existsSync(this.localLedgerPath)) {
        return JSON.parse(fs.readFileSync(this.localLedgerPath, 'utf-8'));
      }
    } catch {
      // Return empty on parse fail
    }
    return [];
  }

  private static saveLocalLedger(ledger: PredictionLedgerV3Record[]): void {
    try {
      const dir = path.dirname(this.localLedgerPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.localLedgerPath, JSON.stringify(ledger, null, 2));
    } catch (err: unknown) {
      console.error('[PredictionLedgerRepository] saveLocalLedger failed:', err);
    }
  }

  private static loadLocalSettlements(): PredictionSettlementV3Record[] {
    try {
      if (fs.existsSync(this.localSettlementsPath)) {
        return JSON.parse(fs.readFileSync(this.localSettlementsPath, 'utf-8'));
      }
    } catch {
      // Return empty
    }
    return [];
  }

  private static saveLocalSettlements(settlements: PredictionSettlementV3Record[]): void {
    try {
      const dir = path.dirname(this.localSettlementsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.localSettlementsPath, JSON.stringify(settlements, null, 2));
    } catch (err: unknown) {
      console.error('[PredictionLedgerRepository] saveLocalSettlements failed:', err);
    }
  }

  /**
   * Retrieves the latest entry from the prediction ledger to get the prior hash.
   */
  public static async getLatestLedgerEntry(): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('prediction_ledger_v3')
        .select('prediction_hash')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) return data.prediction_hash;
    } catch {
      // Fallback to local
    }

    const localLedger = this.loadLocalLedger();
    if (localLedger.length === 0) return null;
    return localLedger[localLedger.length - 1].prediction_hash || null;
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

    const dbRecord = {
      ...record,
      prediction_hash: hash,
      prior_hash: priorHash
    };

    // 1. Try DB Write
    let dbSuccess = false;
    try {
      const { error } = await supabase.from('prediction_ledger_v3').insert(dbRecord);
      if (!error) {
        dbSuccess = true;
      }
    } catch {
      // Fail over to local
    }

    // 2. Always write to local file cache as fallback / validation trace
    const localLedger = this.loadLocalLedger();
    localLedger.push(dbRecord);
    this.saveLocalLedger(localLedger);

    console.log(`[PredictionLedgerRepository] Appended prediction. DB Success: ${dbSuccess} | Hash: ${hash}`);
    return hash;
  }

  /**
   * Settles a prediction.
   * Appends a settlement record to the ledger settlements table referencing the prediction hash.
   */
  public static async settlePrediction(settlement: PredictionSettlementV3Record): Promise<boolean> {
    let dbSuccess = false;
    try {
      const { error } = await supabase.from('prediction_settlements_v3').insert({
        prediction_hash: settlement.prediction_hash,
        status: settlement.status,
        profit_loss: settlement.profit_loss,
        closing_odds: settlement.closing_odds,
        actual_clv: settlement.actual_clv,
        brier_contribution: settlement.brier_contribution,
        logloss_contribution: settlement.logloss_contribution
      });
      if (!error) {
        dbSuccess = true;
      }
    } catch {
      // Fallback
    }

    const localSettlements = this.loadLocalSettlements();
    localSettlements.push(settlement);
    this.saveLocalSettlements(localSettlements);

    console.log(`[PredictionLedgerRepository] Settled prediction. DB Success: ${dbSuccess} | Hash: ${settlement.prediction_hash}`);
    return true;
  }

  /**
   * Retrieves prediction details by its cryptographic hash.
   */
  public static async getPredictionByHash(hash: string): Promise<any | null> {
    try {
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

      if (!error && data) return data;
    } catch {
      // Fallback to local
    }

    const localLedger = this.loadLocalLedger();
    const record = localLedger.find((r) => r.prediction_hash === hash);
    if (!record) return null;

    const localSettlements = this.loadLocalSettlements();
    const settlement = localSettlements.find((s) => s.prediction_hash === hash);

    return {
      ...record,
      prediction_settlements_v3: settlement ? [settlement] : []
    };
  }

  /**
   * Retrieves predictions by matchId.
   */
  public static async getPredictionsByMatchId(matchId: string): Promise<any[]> {
    try {
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
        .eq('match_id', matchId);

      if (!error && data) return data;
    } catch {
      // Fallback
    }

    const localLedger = this.loadLocalLedger().filter((r) => r.match_id === matchId);
    const localSettlements = this.loadLocalSettlements();

    return localLedger.map((record) => {
      const settlement = localSettlements.find((s) => s.prediction_hash === record.prediction_hash);
      return {
        ...record,
        prediction_settlements_v3: settlement ? [settlement] : []
      };
    });
  }

  /**
   * Retrieves all predictions from the ledger.
   */
  public static async getAllPredictions(): Promise<any[]> {
    try {
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
        `);

      if (!error && data) return data;
    } catch {
      // Fallback
    }

    const localLedger = this.loadLocalLedger();
    const localSettlements = this.loadLocalSettlements();

    return localLedger.map((record) => {
      const settlement = localSettlements.find((s) => s.prediction_hash === record.prediction_hash);
      return {
        ...record,
        prediction_settlements_v3: settlement ? [settlement] : []
      };
    });
  }

  /**
   * Clears all local files (for clean testing).
   */
  public static clearLocalFiles(): void {
    try {
      if (fs.existsSync(this.localLedgerPath)) fs.unlinkSync(this.localLedgerPath);
      if (fs.existsSync(this.localSettlementsPath)) fs.unlinkSync(this.localSettlementsPath);
    } catch {
      // Ignore
    }
  }
}
