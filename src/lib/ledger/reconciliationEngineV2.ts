// ============================================================================
// CANONICAL RECONCILIATION ENGINE V2 — 11-POINT CORRUPTION AUDIT
// ============================================================================
// Location: src/lib/ledger/reconciliationEngineV2.ts
//
// Invariants enforced (Section Q & Section R Criteria 24):
// Detects and audits all 11 data integrity and corruption conditions:
// 1.  ORPHAN_PREDICTION: Prediction references non-existent fixture
// 2.  MISSING_FIXTURE: Prediction lacks canonical fixture mapping
// 3.  STALE_FIXTURE: Fixture in registry exceeds freshness SLA
// 4.  MISSING_ODDS: Prediction has null, NaN, or <= 1.0 odds
// 5.  POST_KICKOFF_PREDICTION: Prediction recorded at or after kickoff
// 6.  MISSING_SETTLEMENT: Match is FINISHED but prediction remains pending
// 7.  DUPLICATE_SETTLEMENT: Multiple or contradictory settlement records
// 8.  SALMO_SYNC_MISMATCH: Active Salmo record mismatch with canonical ledger
// 9.  STALE_SALMO_RECORD: Stale or kicked-off fixture in active Salmo picks
// 10. FABRICATED_ODDS: Synthetic or mock odds detected in production ledger
// 11. FABRICATED_CLV: Closing line value fabricated without valid closing odds
// ============================================================================

import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';
import { CanonicalFixtureFreshnessGate } from '@/lib/services/canonicalFixtureFreshnessGate';

export type ReconciliationIssueCode =
  | 'ORPHAN_PREDICTION'
  | 'MISSING_FIXTURE'
  | 'STALE_FIXTURE'
  | 'MISSING_ODDS'
  | 'POST_KICKOFF_PREDICTION'
  | 'MISSING_SETTLEMENT'
  | 'DUPLICATE_SETTLEMENT'
  | 'SALMO_SYNC_MISMATCH'
  | 'STALE_SALMO_RECORD'
  | 'FABRICATED_ODDS'
  | 'FABRICATED_CLV';

export interface ReconciliationIssue {
  code: ReconciliationIssueCode;
  severity: 'CRITICAL' | 'WARNING';
  entityId: string;
  message: string;
  timestampUtc: string;
}

export interface ReconciliationAuditResult {
  status: 'HEALTHY' | 'RECONCILIATION_FAILURE';
  totalIssues: number;
  issuesByCode: Record<ReconciliationIssueCode, number>;
  issues: ReconciliationIssue[];
  timestampUtc: string;
}

export interface ReconciliationAuditOptions {
  nowMs?: number;
  predictions?: any[];
  fixtureRegistry?: Record<string, any>;
  salmoActivePicks?: any[];
  staleFixtureThresholdMs?: number;
}

export class ReconciliationEngineV2 {
  public static readonly DEFAULT_STALE_FIXTURE_THRESHOLD_MS = 24 * 3600 * 1000; // 24 hours

  public static runAudit(options: ReconciliationAuditOptions = {}): ReconciliationAuditResult {
    const nowMs = options.nowMs ?? Date.now();
    const timestampUtc = new Date(nowMs).toISOString();
    const staleThresholdMs = options.staleFixtureThresholdMs ?? this.DEFAULT_STALE_FIXTURE_THRESHOLD_MS;

    const predictions = options.predictions ?? CanonicalBetLedgerService.getAllPredictions();
    const fixtureRegistry = options.fixtureRegistry ?? CanonicalFixtureFreshnessGate.loadRegistry();
    const salmoActivePicks = options.salmoActivePicks ?? [];

    const issues: ReconciliationIssue[] = [];
    const issuesByCode: Record<ReconciliationIssueCode, number> = {
      ORPHAN_PREDICTION: 0,
      MISSING_FIXTURE: 0,
      STALE_FIXTURE: 0,
      MISSING_ODDS: 0,
      POST_KICKOFF_PREDICTION: 0,
      MISSING_SETTLEMENT: 0,
      DUPLICATE_SETTLEMENT: 0,
      SALMO_SYNC_MISMATCH: 0,
      STALE_SALMO_RECORD: 0,
      FABRICATED_ODDS: 0,
      FABRICATED_CLV: 0,
    };

    const addIssue = (
      code: ReconciliationIssueCode,
      severity: 'CRITICAL' | 'WARNING',
      entityId: string,
      message: string
    ) => {
      issuesByCode[code]++;
      issues.push({
        code,
        severity,
        entityId,
        message,
        timestampUtc,
      });
    };

    // Build fast lookup set/maps of fixture registry
    const fixtureMapByCanonical = new Map<string, any>();
    const fixtureMapByProvider = new Map<string, any>();

    for (const [key, fix] of Object.entries(fixtureRegistry)) {
      if (!fix) continue;
      const cId = fix.canonicalMatchId || key;
      fixtureMapByCanonical.set(cId, fix);
      if (fix.providerMatchId) {
        fixtureMapByProvider.set(fix.providerMatchId, fix);
      }

      // Check 3: STALE_FIXTURE
      const updatedStr = fix.canonicalUpdatedAtUtc || fix.providerFetchedAtUtc;
      if (updatedStr) {
        const updatedMs = new Date(updatedStr).getTime();
        if (!isNaN(updatedMs) && nowMs - updatedMs > staleThresholdMs) {
          addIssue(
            'STALE_FIXTURE',
            'WARNING',
            cId,
            `Fixture ${cId} has not been updated in ${Math.round((nowMs - updatedMs) / 3600000)}h (exceeds SLA).`
          );
        }
      }
    }

    // Prediction audit tracking
    const seenPredictionIds = new Set<string>();
    const canonicalPredictionMap = new Map<string, any>();

    for (const pred of predictions) {
      if (!pred) continue;
      const predId = pred.predictionId || 'UNKNOWN_PRED';
      canonicalPredictionMap.set(predId, pred);

      // Check 7: DUPLICATE_SETTLEMENT / ID collision
      if (seenPredictionIds.has(predId)) {
        addIssue(
          'DUPLICATE_SETTLEMENT',
          'CRITICAL',
          predId,
          `Duplicate prediction identifier detected in canonical ledger: ${predId}.`
        );
      }
      seenPredictionIds.add(predId);

      // Check 1 & 2: MISSING_FIXTURE / ORPHAN_PREDICTION
      const fixId = pred.canonicalFixtureId || pred.matchId || pred.fixtureId;
      if (!fixId) {
        addIssue(
          'MISSING_FIXTURE',
          'CRITICAL',
          predId,
          `Prediction ${predId} lacks canonical fixture reference.`
        );
      } else {
        const fixture = fixtureMapByCanonical.get(fixId) || fixtureMapByProvider.get(fixId);
        if (!fixture) {
          addIssue(
            'ORPHAN_PREDICTION',
            'CRITICAL',
            predId,
            `Prediction ${predId} references missing fixture ID: ${fixId}.`
          );
        } else {
          // Check 6: MISSING_SETTLEMENT
          if (fixture.status === 'FINISHED') {
            if (pred.status !== 'SETTLED' && pred.status !== 'VOID') {
              addIssue(
                'MISSING_SETTLEMENT',
                'CRITICAL',
                predId,
                `Fixture ${fixId} is FINISHED but prediction ${predId} remains unsettled (${pred.status}).`
              );
            }
          }
        }
      }

      // Check 4: MISSING_ODDS
      const odds = pred.marketOdds ?? pred.odds;
      if (odds === undefined || odds === null || isNaN(Number(odds)) || Number(odds) <= 1.0) {
        addIssue(
          'MISSING_ODDS',
          'CRITICAL',
          predId,
          `Prediction ${predId} has invalid or missing odds: ${odds}.`
        );
      }

      // Check 10: FABRICATED_ODDS
      const bookmaker = (pred.bookmaker || '').toLowerCase();
      const provider = (pred.provider || pred.oddsProvider || '').toLowerCase();
      if (
        bookmaker.includes('synthetic') ||
        bookmaker.includes('mock') ||
        provider.includes('synthetic') ||
        provider.includes('mock')
      ) {
        addIssue(
          'FABRICATED_ODDS',
          'CRITICAL',
          predId,
          `Prediction ${predId} uses synthetic or mock odds provider: ${pred.bookmaker || pred.provider}.`
        );
      }

      // Check 5: POST_KICKOFF_PREDICTION (Anti-Lookahead)
      const kickStr = pred.kickoffTimestamp || pred.kickoffUtc;
      const predStr = pred.predictionTimestamp || pred.predictionTimestampUtc;
      if (kickStr && predStr) {
        const kickMs = new Date(kickStr).getTime();
        const predMs = new Date(predStr).getTime();
        if (!isNaN(kickMs) && !isNaN(predMs) && predMs >= kickMs && pred.status !== 'REJECTED') {
          addIssue(
            'POST_KICKOFF_PREDICTION',
            'CRITICAL',
            predId,
            `Prediction ${predId} created at ${predStr} after kickoff ${kickStr} (temporal violation).`
          );
        }
      }

      // Check 11: FABRICATED_CLV
      if (pred.clvRecord && pred.clvRecord.clvStatus === 'AVAILABLE') {
        const closingOdds = pred.clvRecord.closingOdds;
        const clvPct = pred.clvRecord.clvPercentage;
        if (closingOdds === null || closingOdds === undefined || isNaN(closingOdds) || closingOdds <= 1.0 || clvPct === null || clvPct === undefined) {
          addIssue(
            'FABRICATED_CLV',
            'CRITICAL',
            predId,
            `Prediction ${predId} has clvStatus=AVAILABLE but closingOdds (${closingOdds}) or clvPercentage (${clvPct}) is invalid or null.`
          );
        }
      }
    }

    // Check 8 & 9: SALMO picks audit
    for (const salmoPick of salmoActivePicks) {
      if (!salmoPick) continue;
      const pickId = salmoPick.predictionId || salmoPick.projectionId || 'UNKNOWN_SALMO_PICK';

      // Check 9: STALE_SALMO_RECORD
      const kickStr = salmoPick.kickoffUtc || salmoPick.kickoffTimestamp;
      if (kickStr) {
        const kickMs = new Date(kickStr).getTime();
        if (!isNaN(kickMs) && kickMs <= nowMs) {
          addIssue(
            'STALE_SALMO_RECORD',
            'CRITICAL',
            pickId,
            `Salmo active pick ${pickId} (${salmoPick.homeTeam} vs ${salmoPick.awayTeam}) has kickoff in the past (${kickStr}).`
          );
        }
      }

      // Check 8: SALMO_SYNC_MISMATCH
      if (canonicalPredictionMap.size > 0 && !canonicalPredictionMap.has(pickId)) {
        addIssue(
          'SALMO_SYNC_MISMATCH',
          'WARNING',
          pickId,
          `Salmo active pick ${pickId} was not found in canonical prediction ledger.`
        );
      }
    }

    const totalIssues = issues.length;
    const status = totalIssues === 0 ? 'HEALTHY' : 'RECONCILIATION_FAILURE';

    return {
      status,
      totalIssues,
      issuesByCode,
      issues,
      timestampUtc,
    };
  }
}
