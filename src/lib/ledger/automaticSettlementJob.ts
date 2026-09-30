// ============================================================================
// AUTOMATIC SETTLEMENT JOB & SCHEDULED SETTLEMENT PIPELINE
// ============================================================================
// Location: src/lib/ledger/automaticSettlementJob.ts
//
// Invariants enforced (Section H & I):
// 1. Triggered when match status = FINISHED and verified final score exists.
// 2. Loads immutable prediction snapshot, original selection, line, and odds.
// 3. Executes deterministic settlement via CanonicalSettlementEngine without mutating
//    the original pre-kickoff prediction snapshot.
// 4. Settles Asian Handicap quarter-lines, Over/Under, and BTTS accurately.
// 5. Handles CANCELLED / ABANDONED fixtures as VOID.
// 6. Idempotent: re-settling does not double-count profit/loss.
// ============================================================================

import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';
import { CanonicalSettlementEngine } from '@/lib/ledger/canonicalSettlementEngine';
import { CanonicalSettlementRecord } from './predictionLedgerTypes';
import { CanonicalFixtureFreshnessGate, CanonicalFixtureRecord } from '@/lib/services/canonicalFixtureFreshnessGate';

export interface AutomaticSettlementJobOptions {
  nowMs?: number;
  batchSize?: number;
  competition?: string;
}

export interface AutomaticSettlementJobResult {
  success: boolean;
  timestampUtc: string;
  settledCount: number;
  skippedCount: number;
  errorCount: number;
  settledPredictions: CanonicalSettlementRecord[];
  errors: Array<{ predictionId: string; error: string }>;
}

export class AutomaticSettlementJob {
  /**
   * Executes the automatic settlement job across all unsettled canonical predictions.
   */
  public static async execute(
    options: AutomaticSettlementJobOptions = {}
  ): Promise<AutomaticSettlementJobResult> {
    const nowMs = options.nowMs ?? Date.now();
    const timestampUtc = new Date(nowMs).toISOString();

    const result: AutomaticSettlementJobResult = {
      success: true,
      timestampUtc,
      settledCount: 0,
      skippedCount: 0,
      errorCount: 0,
      settledPredictions: [],
      errors: [],
    };

    try {
      const fixtureRegistry = CanonicalFixtureFreshnessGate.loadRegistry();
      const allPredictions = CanonicalBetLedgerService.getAllPredictions();

      // Build index of fixtures for fast lookup by multiple keys
      const fixtureByCanonicalId = new Map<string, CanonicalFixtureRecord>();
      const fixtureByProviderId = new Map<string, CanonicalFixtureRecord>();
      const fixtureByTeamKey = new Map<string, CanonicalFixtureRecord>();

      for (const fix of Object.values(fixtureRegistry)) {
        if (fix.canonicalMatchId) {
          fixtureByCanonicalId.set(fix.canonicalMatchId, fix);
        }
        if (fix.providerMatchId) {
          fixtureByProviderId.set(fix.providerMatchId, fix);
        }
        if (fix.homeTeam && fix.awayTeam && fix.kickoffUtc) {
          const teamKey = `${CanonicalFixtureFreshnessGate.cleanTeamName(fix.homeTeam)}_${CanonicalFixtureFreshnessGate.cleanTeamName(fix.awayTeam)}_${fix.kickoffUtc.slice(0, 10)}`;
          fixtureByTeamKey.set(teamKey, fix);
        }
      }

      for (const pred of allPredictions) {
        // Only settle unsettled predictions
        if (pred.status === 'SETTLED' || pred.settlement !== null) {
          result.skippedCount++;
          continue;
        }

        // Filter competition if specified
        if (options.competition && pred.competition !== options.competition && pred.league !== options.competition) {
          result.skippedCount++;
          continue;
        }

        try {
          // Find matching fixture
          let matchedFixture = fixtureByCanonicalId.get(pred.canonicalFixtureId);
          if (!matchedFixture) {
            matchedFixture = fixtureByProviderId.get(pred.canonicalFixtureId);
          }
          if (!matchedFixture && pred.homeTeam && pred.awayTeam && pred.kickoffTimestamp) {
            const teamKey = `${CanonicalFixtureFreshnessGate.cleanTeamName(pred.homeTeam)}_${CanonicalFixtureFreshnessGate.cleanTeamName(pred.awayTeam)}_${pred.kickoffTimestamp.slice(0, 10)}`;
            matchedFixture = fixtureByTeamKey.get(teamKey);
          }

          if (!matchedFixture) {
            result.skippedCount++;
            continue;
          }

          const status = matchedFixture.status;
          const isFinished = status === 'FINISHED';
          const isCancelled = status === 'CANCELLED';
          const isAbandoned = status === 'ABANDONED';

          if (isFinished) {
            // Must have verified final score
            const hasScore =
              matchedFixture.homeGoals !== null &&
              matchedFixture.homeGoals !== undefined &&
              matchedFixture.awayGoals !== null &&
              matchedFixture.awayGoals !== undefined;

            if (!hasScore) {
              result.skippedCount++;
              continue;
            }

            const matchResult = {
              status: 'FT',
              homeGoals: matchedFixture.homeGoals!,
              awayGoals: matchedFixture.awayGoals!,
              closingOdds: matchedFixture.metadata?.closingOdds ?? null,
              closingLine: matchedFixture.metadata?.closingLine ?? null,
            };

            const settlementRes = CanonicalSettlementEngine.settlePrediction(
              pred,
              matchResult,
              { nowMs }
            );

            if (settlementRes.settled && settlementRes.settlement) {
              result.settledCount++;
              result.settledPredictions.push(settlementRes.settlement);
            } else {
              result.skippedCount++;
            }
          } else if (isCancelled || isAbandoned) {
            const matchResult = {
              status: isCancelled ? 'CANC' : 'ABD',
              homeGoals: null,
              awayGoals: null,
              closingOdds: null,
              closingLine: null,
            };

            const settlementRes = CanonicalSettlementEngine.settlePrediction(
              pred,
              matchResult,
              { nowMs }
            );

            if (settlementRes.settled && settlementRes.settlement) {
              result.settledCount++;
              result.settledPredictions.push(settlementRes.settlement);
            } else {
              result.skippedCount++;
            }
          } else {
            // Still in progress or scheduled
            result.skippedCount++;
          }
        } catch (predErr: any) {
          result.errorCount++;
          result.errors.push({
            predictionId: pred.predictionId,
            error: predErr.message || 'Settlement execution failed',
          });
        }
      }
    } catch (jobErr: any) {
      result.success = false;
      result.errorCount++;
      result.errors.push({
        predictionId: 'JOB_LEVEL',
        error: jobErr.message || 'Automatic settlement job failed unexpectedly',
      });
    }

    return result;
  }
}
