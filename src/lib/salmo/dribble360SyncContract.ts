/**
 * SALMO SYNCHRONIZATION CONTRACT — Dribble360 Integration
 * 
 * Defines the strict, versioned contract for syncing HandicapLab predictions
 * and intelligence downstream to Salmo.
 * 
 * Invariants (EPIC §43):
 * 1. DRIBBLE360_SYNC_ENABLED=false by default.
 * 2. Complete provenance tracking (Salmo -> HandicapLab -> Prediction -> Model -> Feature -> Odds -> Data -> Raw Provider).
 * 3. Never publish Dribble360 data publicly or to paying users until G5 (Licence) & Final approval pass.
 * 4. Every synced record explicitly distinguishes data_provider from odds_provider.
 */

import * as crypto from 'crypto';

export const DRIBBLE360_SYNC_CONTRACT_VERSION = '1.0.0-trial';

/**
 * Check if synchronization to Salmo is permitted.
 * Strictly blocked unless DRIBBLE360_SYNC_ENABLED=true AND license gate passes.
 */
export function isDribble360SyncAllowed(): boolean {
  const envEnabled = process.env.DRIBBLE360_SYNC_ENABLED === 'true';
  const licenseCleared = process.env.DRIBBLE360_LICENSE_CLEARED === 'true';
  // Per EPIC §43, sync is disabled by default and requires explicit double-confirmation
  return envEnabled && licenseCleared;
}

export type SupportedMarket = 'AH' | 'BTTS' | 'OU';

export type AsianHandicapLine =
  | 0
  | 0.25
  | -0.25
  | 0.5
  | -0.5
  | 0.75
  | -0.75
  | 1.0
  | -1.0
  | 1.25
  | -1.25
  | 1.5
  | -1.5
  | 1.75
  | -1.75
  | 2.0
  | -2.0;

export type OverUnderLine = 1.0 | 1.5 | 2.0 | 2.25 | 2.5 | 2.75 | 3.0 | 3.5 | 4.0;

export interface ProvenanceMetadata {
  data_provider: 'dribble360' | 'api-football' | 'football-data.co.uk';
  odds_provider: 'pinnacle' | 'oddspapi' | 'sbobet' | 'none';
  provider_match_id: string;
  canonical_match_id: string;
  source_endpoint: string;
  retrieved_at: string;
  data_hash: string;
  model_version: string;
  feature_snapshot_id: string;
  contract_version: string;
}

export interface SalmoSyncRecord {
  /** Unique prediction UUID */
  id: string;
  canonical_fixture_id: string;
  provider_match_id: string;
  competition: string;
  season: string;
  kickoff_utc: string;
  home_team: string;
  away_team: string;

  /** Market definition */
  market: SupportedMarket;
  line: number;
  selection: 'home' | 'away' | 'over' | 'under' | 'yes' | 'no';

  /** Model metrics */
  model_probability: number;
  market_odds: number | null;
  implied_probability: number | null;
  edge: number | null;
  expected_value: number | null;
  is_value_bet: boolean;
  confidence_score: number;

  /** Settlement (null if unsettled) */
  result: 'WIN' | 'LOSS' | 'PUSH' | 'HALF_WIN' | 'HALF_LOSS' | null;
  settled_at: string | null;
  profit_loss: number | null;
  closing_odds: number | null;
  clv_percentage: number | null;

  /** Provenance chain */
  provenance: ProvenanceMetadata;

  /** Verification and Governance */
  status: 'RESEARCH_SHADOW' | 'TRIAL_VALIDATION' | 'STAGED' | 'LIVE_BLOCKED';
  created_at: string;
}

export class SalmoSyncEngine {
  /**
   * Generates a deterministic payload hash for a sync record
   */
  static generateRecordHash(record: Omit<SalmoSyncRecord, 'provenance'>): string {
    const raw = JSON.stringify({
      canonical_fixture_id: record.canonical_fixture_id,
      market: record.market,
      line: record.line,
      selection: record.selection,
      prob: record.model_probability,
      odds: record.market_odds,
    });
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Prepares a prediction for Salmo downstream consumption
   * Throws if sync is attempted while DRIBBLE360_SYNC_ENABLED=false
   */
  static prepareSyncPayload(record: SalmoSyncRecord): {
    allowed: boolean;
    reason: string;
    payload: SalmoSyncRecord | null;
  } {
    if (!isDribble360SyncAllowed()) {
      return {
        allowed: false,
        reason: 'BLOCKED: DRIBBLE360_SYNC_ENABLED=false or License Gate G5 unverified. Trial data is RESEARCH_ONLY.',
        payload: null,
      };
    }

    return {
      allowed: true,
      reason: 'READY',
      payload: record,
    };
  }
}

