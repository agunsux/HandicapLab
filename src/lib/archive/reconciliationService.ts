// ============================================================================
// HANDICAPLAB <-> SALMO RECONCILIATION SERVICE
// ============================================================================
// Location: src/lib/archive/reconciliationService.ts
//
// Invariants enforced:
// 1. Detect missing predictions between HandicapLab and SALMO consumer feeds.
// 2. Detect duplicate prediction records.
// 3. Detect stale synchronization lag (> 15 minutes).
// 4. Detect settlement mismatches (e.g. settled in HandicapLab but pending in SALMO).
// 5. Fail-closed visibility: Surface reconciliation discrepancies as explicit errors.
// ============================================================================

import {
  PredictionArchiveRecord,
  ReconciliationReport,
  ReconciliationDiscrepancy,
} from './types';
import { PredictionArchiveService } from './predictionArchiveService';

export class ReconciliationService {
  /**
   * Reconciles HandicapLab canonical archive against consumer (SALMO) prediction records.
   */
  public static reconcileWithConsumer(consumerRecords: Array<{
    predictionId: string;
    fixtureId: string;
    status: string;
    settlementOutcome?: string | null;
    marketOdds?: number;
    updatedAt?: string;
  }>): ReconciliationReport {
    const archive = PredictionArchiveService.loadArchive();
    const hlRecords = Object.values(archive);

    const discrepancies: ReconciliationDiscrepancy[] = [];
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const consumerMap = new Map<string, typeof consumerRecords[0]>();
    const seenConsumerIds = new Set<string>();

    for (const c of consumerRecords) {
      if (seenConsumerIds.has(c.predictionId)) {
        discrepancies.push({
          discrepancyId: `disc_dup_${c.predictionId}`,
          type: 'DUPLICATE',
          recordId: c.predictionId,
          expected: 'Unique record in consumer',
          actual: 'Duplicate record in consumer feed',
          detectedAt: nowIso,
          severity: 'CRITICAL',
        });
      }
      seenConsumerIds.add(c.predictionId);
      consumerMap.set(c.predictionId, c);
    }

    // 1. Check for records missing in SALMO
    for (const hl of hlRecords) {
      const c = consumerMap.get(hl.predictionId);
      if (!c) {
        // If it's an active daily pick or settled record, it must be present
        if (hl.status === 'ACTIVE' || hl.status === 'SETTLED') {
          discrepancies.push({
            discrepancyId: `disc_missing_${hl.predictionId}`,
            type: 'MISSING_IN_SALMO',
            recordId: hl.predictionId,
            expected: `Present in SALMO (${hl.status})`,
            actual: 'Missing in SALMO feed',
            detectedAt: nowIso,
            severity: 'CRITICAL',
          });
        }
        continue;
      }

      // 2. Check for settlement status mismatch
      if (hl.status === 'SETTLED') {
        const expectedOutcome = hl.settlement?.outcome;
        if (c.status !== 'SETTLED' || (c.settlementOutcome && c.settlementOutcome !== expectedOutcome)) {
          discrepancies.push({
            discrepancyId: `disc_stl_${hl.predictionId}`,
            type: 'SETTLEMENT_MISMATCH',
            recordId: hl.predictionId,
            expected: `Status: SETTLED, Outcome: ${expectedOutcome}`,
            actual: `Status: ${c.status}, Outcome: ${c.settlementOutcome}`,
            detectedAt: nowIso,
            severity: 'CRITICAL',
          });
        }
      }

      // 3. Check for odds snapshot divergence
      if (c.marketOdds && Math.abs(c.marketOdds - hl.marketOdds) > 0.001) {
        discrepancies.push({
          discrepancyId: `disc_odds_${hl.predictionId}`,
          type: 'ODDS_MISMATCH',
          recordId: hl.predictionId,
          expected: hl.marketOdds,
          actual: c.marketOdds,
          detectedAt: nowIso,
          severity: 'WARNING',
        });
      }

      // 4. Check for staleness
      if (c.updatedAt) {
        const cUpdatedMs = new Date(c.updatedAt).getTime();
        const hlUpdatedMs = new Date(hl.updatedAt).getTime();
        if (hlUpdatedMs - cUpdatedMs > 15 * 60 * 1000) {
          discrepancies.push({
            discrepancyId: `disc_stale_${hl.predictionId}`,
            type: 'STALE_SNAPSHOT',
            recordId: hl.predictionId,
            expected: `Synced within 15m of ${hl.updatedAt}`,
            actual: `Last consumer update was at ${c.updatedAt}`,
            detectedAt: nowIso,
            severity: 'WARNING',
          });
        }
      }
    }

    let syncLagSeconds = 0;
    if (consumerRecords.length > 0 && consumerRecords[0].updatedAt) {
      syncLagSeconds = Math.max(0, Math.floor((nowMs - new Date(consumerRecords[0].updatedAt).getTime()) / 1000));
    }

    return {
      reconciledAtUtc: nowIso,
      handicapLabCount: hlRecords.length,
      salmoCount: consumerRecords.length,
      isConsistent: discrepancies.length === 0,
      discrepancies,
      syncLagSeconds,
    };
  }

  /**
   * Self-reconciles canonical archive consistency (checks duplicate IDs, internal integrity).
   */
  public static reconcileArchive(): ReconciliationReport {
    const archive = PredictionArchiveService.loadArchive();
    const records = Object.values(archive);
    const consumerRecords = records.map((r) => ({
      predictionId: r.predictionId,
      fixtureId: r.fixtureId,
      status: r.status,
      settlementOutcome: r.settlement?.outcome || null,
      marketOdds: r.marketOdds,
      updatedAt: r.updatedAt,
    }));
    return this.reconcileWithConsumer(consumerRecords);
  }
}
