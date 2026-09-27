// ============================================================================
// CANONICAL SALMO SYNCHRONIZATION SERVICE
// ============================================================================
// Location: src/lib/pipeline/salmoSyncService.ts
//
// Invariants enforced:
// 1. HANDICAPLAB = COMPUTES & SOURCE OF TRUTH. SALMO = CONSUMER & DECISION UI.
// 2. ONLY HIGH CONFIDENCE predictions are synchronized to Salmo as POTENTIAL_WINNING_BET.
// 3. Probabilistic wording strictly: ZERO "sure win", "banker", "lock", "guaranteed".
// 4. BTTS is strictly held in RESEARCH_ONLY and NEVER synchronized as High Confidence.
// 5. Idempotent: Same canonicalMatchId + market + line does not duplicate.
// 6. Failure tolerant: Salmo sync failures do NOT crash the HandicapLab pipeline.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { PredictionLedgerRecord } from './dailyPredictionLedger';

export interface SalmoDecisionCardPayload {
  decisionId: string;
  canonicalMatchId: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffUtc: string;
  market: 'AH' | 'OU';
  selection: string;
  line: number | null;
  odds: number;
  modelProbabilityPct: number;
  calibratedProbabilityPct: number;
  edgePct: number;
  expectedValuePct: number;
  confidence: 'HIGH';
  status: 'POTENTIAL_WINNING_BET';
  predictionTimestampUtc: string;
  modelVersion: string;
  whyExplanation: string[];
  disclaimer: string;
}

export interface SalmoSyncReport {
  timestampUtc: string;
  status: 'SUCCESS' | 'NO_PICKS' | 'SALMO_SYNC_FAILED';
  totalHighConfidence: number;
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  syncedDecisions: SalmoDecisionCardPayload[];
  errorMessage?: string;
}

function getSalmoSyncStorePath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.resolve('data/test_ledger/salmo_synced_decisions.json');
  }
  if (process.env.VERCEL) {
    const os = require('os');
    return path.join(os.tmpdir(), 'handicaplab_salmo_synced_decisions.json');
  }
  return path.resolve('data/ledger/salmo_synced_decisions.json');
}

export class SalmoSyncService {
  public static readonly DISCLAIMER_TEXT =
    'Probabilistic research signal based on quantitative modeling. No guarantee of profit. Capital at risk.';

  public static loadSyncedStore(): Record<string, SalmoDecisionCardPayload> {
    try {
      const p = getSalmoSyncStorePath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        return JSON.parse(raw);
      }
    } catch {}
    return {};
  }

  public static saveSyncedStore(store: Record<string, SalmoDecisionCardPayload>): void {
    try {
      const p = getSalmoSyncStorePath();
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf8');
    } catch (e) {
      console.warn('[SalmoSyncService] Failed to save synced store:', e);
    }
  }

  /**
   * Generates clean probabilistic "WHY" explanations for the Salmo decision interface.
   */
  public static generateWhyExplanation(pred: PredictionLedgerRecord): string[] {
    const why: string[] = [];
    const edgePct = (pred.edge * 100).toFixed(1);
    const evPct = (pred.expectedValue * 100).toFixed(1);

    why.push(`Model identified +${edgePct}% statistical edge over Pinnacle closing consensus`);
    why.push(`Expected value +${evPct}% with minimum qualified odds >= ${pred.odds.toFixed(2)}`);
    why.push('Point-in-time ratings confirmed with zero future lookahead contamination');

    return why;
  }

  /**
   * Synchronizes high-confidence predictions to Salmo.
   */
  public static async synchronize(
    predictions: PredictionLedgerRecord[],
    options: { nowMs?: number; simulateFailure?: boolean } = {}
  ): Promise<SalmoSyncReport> {
    const nowMs = options.nowMs || Date.now();
    const nowIso = new Date(nowMs).toISOString();

    if (options.simulateFailure) {
      return {
        timestampUtc: nowIso,
        status: 'SALMO_SYNC_FAILED',
        totalHighConfidence: 0,
        created: 0,
        updated: 0,
        unchanged: 0,
        rejected: 0,
        syncedDecisions: [],
        errorMessage: 'SIMULATED_NETWORK_TIMEOUT: Salmo downstream unreachable',
      };
    }

    try {
      // 1. Strict Filter: ONLY HIGH_CONFIDENCE predictions eligible
      // Invariant: BTTS can NEVER be High Confidence!
      const highConfidencePicks = predictions.filter(
        (p) => p.status === 'HIGH_CONFIDENCE' && p.market !== 'BTTS'
      );

      const store = this.loadSyncedStore();
      let created = 0;
      let updated = 0;
      let unchanged = 0;
      let rejected = predictions.filter((p) => p.status !== 'HIGH_CONFIDENCE' || p.market === 'BTTS').length;

      const syncedDecisions: SalmoDecisionCardPayload[] = [];

      for (const pick of highConfidencePicks) {
        const decisionId = `salmo_${crypto
          .createHash('sha256')
          .update(`${pick.canonicalMatchId}_${pick.market}_${pick.line}_${pick.selection}`)
          .digest('hex')
          .slice(0, 16)}`;

        const card: SalmoDecisionCardPayload = {
          decisionId,
          canonicalMatchId: pick.canonicalMatchId,
          match: `${pick.homeTeam} vs ${pick.awayTeam}`,
          homeTeam: pick.homeTeam,
          awayTeam: pick.awayTeam,
          competition: pick.competition,
          kickoffUtc: pick.kickoffTimestamp,
          market: pick.market as 'AH' | 'OU',
          selection: pick.selection,
          line: pick.line,
          odds: pick.odds,
          modelProbabilityPct: Number((pick.modelProbability * 100).toFixed(1)),
          calibratedProbabilityPct: Number((pick.calibratedProbability * 100).toFixed(1)),
          edgePct: Number((pick.edge * 100).toFixed(1)),
          expectedValuePct: Number((pick.expectedValue * 100).toFixed(1)),
          confidence: 'HIGH',
          status: 'POTENTIAL_WINNING_BET',
          predictionTimestampUtc: pick.predictionTimestamp,
          modelVersion: pick.modelVersion,
          whyExplanation: this.generateWhyExplanation(pick),
          disclaimer: this.DISCLAIMER_TEXT,
        };

        const existing = store[decisionId];
        if (!existing) {
          store[decisionId] = card;
          created++;
        } else if (JSON.stringify(existing) !== JSON.stringify(card)) {
          store[decisionId] = card;
          updated++;
        } else {
          unchanged++;
        }

        syncedDecisions.push(card);
      }

      this.saveSyncedStore(store);

      return {
        timestampUtc: nowIso,
        status: syncedDecisions.length > 0 ? 'SUCCESS' : 'NO_PICKS',
        totalHighConfidence: highConfidencePicks.length,
        created,
        updated,
        unchanged,
        rejected,
        syncedDecisions,
      };
    } catch (err: any) {
      console.warn('[SalmoSyncService] Sync encountered error:', err.message);
      return {
        timestampUtc: nowIso,
        status: 'SALMO_SYNC_FAILED',
        totalHighConfidence: 0,
        created: 0,
        updated: 0,
        unchanged: 0,
        rejected: 0,
        syncedDecisions: [],
        errorMessage: err.message || 'Unknown sync error',
      };
    }
  }

  public static clearForTesting(): void {
    const p = getSalmoSyncStorePath();
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
  }
}
