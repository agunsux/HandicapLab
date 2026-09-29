// ============================================================================
// CANONICAL MULTI-MARKET SETTLEMENT ENGINE
// ============================================================================
// Location: src/lib/ledger/canonicalSettlementEngine.ts
//
// Invariants enforced:
// 1. Markets strictly: AH (quarter lines), OU (full/half/quarter), BTTS (yes/no).
// 2. Authoritative ExactSettlementEngine integration for deterministic quarter-line math.
// 3. Statuses: PENDING, WIN, HALF_WIN, PUSH, HALF_LOSS, LOSS, VOID, CANCELLED.
// 4. Default research stake: 1.0 unit.
// 5. Point-in-time check: Cannot settle before kickoff timestamp.
// 6. Idempotency: Settling already settled predictions returns existing result without duplicating profit.
// 7. Audit trail: Revisions recorded if authoritative score changes.
// ============================================================================

import { ExactSettlementEngine, SettlementResult } from '@/lib/research/settlement/exactSettlement';
import {
  CanonicalPredictionRecord,
  CanonicalSettlementRecord,
  CanonicalClvRecord,
  SettlementOutcome,
  SettlementRevision,
  ClvStatus,
} from './predictionLedgerTypes';
import { CanonicalBetLedgerService } from './canonicalBetLedger';
import { DailyPredictionLedgerService } from '@/lib/pipeline/dailyPredictionLedger';

export interface MatchResultInput {
  fixtureId?: string;
  canonicalFixtureId?: string;
  status: 'FT' | 'AET' | 'PEN' | 'PST' | 'CANC' | 'ABD' | 'NS' | 'LIVE' | string;
  homeGoals: number | null;
  awayGoals: number | null;
  provider?: string;
  resultReceivedAt?: string;
  closingOdds?: number | null;
  closingLine?: number | null;
}

export class CanonicalSettlementEngine {
  /**
   * Settles a canonical prediction against an authoritative match result.
   */
  public static settlePrediction(
    prediction: CanonicalPredictionRecord,
    result: MatchResultInput,
    options?: { nowMs?: number; revisionReason?: string; forceRecalculate?: boolean }
  ): { settled: boolean; settlement: CanonicalSettlementRecord | null; reason?: string } {
    // 1. Idempotency Check: If already settled and not forcing recalculate, return existing
    if (prediction.status === 'SETTLED' && prediction.settlement && !options?.forceRecalculate) {
      return { settled: true, settlement: prediction.settlement, reason: 'ALREADY_SETTLED' };
    }

    // 2. Point-in-Time Check: Cannot settle before kickoff time
    const currentMs = options?.nowMs ?? Date.now();
    if (prediction.kickoffTimestamp) {
      const kickMs = new Date(prediction.kickoffTimestamp).getTime();
      if (!isNaN(kickMs) && currentMs < kickMs) {
        return {
          settled: false,
          settlement: null,
          reason: 'KICKOFF_NOT_REACHED: Cannot settle prediction before kickoff timestamp',
        };
      }
    }

    const normStatus = result.status?.toUpperCase() || 'UNKNOWN';

    // 3. Postponed Match Check
    if (normStatus === 'PST' || normStatus === 'POSTPONED') {
      return {
        settled: false,
        settlement: null,
        reason: 'MATCH_POSTPONED: Postponed matches remain PENDING',
      };
    }

    const nowIso = new Date(currentMs).toISOString();
    const stakeUnits = 1.0;

    // 4. Cancelled or Abandoned Match Check: Settle as VOID
    if (
      normStatus === 'CANC' ||
      normStatus === 'CANCELLED' ||
      normStatus === 'ABD' ||
      normStatus === 'ABANDONED'
    ) {
      const voidSettlement: CanonicalSettlementRecord = {
        settlementId: `stl_void_${prediction.predictionId}`,
        predictionId: prediction.predictionId,
        canonicalFixtureId: prediction.canonicalFixtureId,
        homeGoals: result.homeGoals ?? 0,
        awayGoals: result.awayGoals ?? 0,
        totalGoals: (result.homeGoals ?? 0) + (result.awayGoals ?? 0),
        matchStatus: normStatus,
        outcome: 'VOID',
        stakeUnits,
        profitUnits: 0.0,
        returnUnits: stakeUnits,
        closingOdds: prediction.marketOdds,
        closingLine: prediction.line,
        clv: 0.0,
        settledAt: nowIso,
        resultProvider: result.provider || 'api-football',
        resultReceivedAt: result.resultReceivedAt || nowIso,
      };

      this.persistSettlement(prediction, voidSettlement, null);
      return { settled: true, settlement: voidSettlement };
    }

    // 5. Finality Check (Must be FT, AET, PEN)
    const isFinal =
      normStatus === 'FT' ||
      normStatus === 'AET' ||
      normStatus === 'PEN' ||
      normStatus === 'FINAL' ||
      normStatus === 'FINISHED';
    if (!isFinal) {
      return {
        settled: false,
        settlement: null,
        reason: `MATCH_NOT_FINAL: Match status '${normStatus}' is not final`,
      };
    }

    // 6. Score Validity Check
    if (
      result.homeGoals === null ||
      result.awayGoals === null ||
      isNaN(result.homeGoals) ||
      isNaN(result.awayGoals)
    ) {
      return {
        settled: false,
        settlement: null,
        reason: 'DATA_ERROR: Match marked final but score is null or invalid',
      };
    }

    const homeGoals = Number(result.homeGoals);
    const awayGoals = Number(result.awayGoals);
    const totalGoals = homeGoals + awayGoals;

    // 7. Execute Mathematical Settlement via ExactSettlementEngine
    let settleRes: SettlementResult;
    try {
      if (prediction.market === 'AH') {
        const selUpper = prediction.selection.toUpperCase();
        const side: 'HOME' | 'AWAY' =
          selUpper.includes('AWAY') ||
          (prediction.awayTeam && selUpper.includes(prediction.awayTeam.toUpperCase()))
            ? 'AWAY'
            : 'HOME';
        settleRes = ExactSettlementEngine.settleAsianHandicap(
          homeGoals,
          awayGoals,
          prediction.line ?? 0,
          prediction.marketOdds,
          side,
          stakeUnits
        );
      } else if (prediction.market === 'OU') {
        const side: 'OVER' | 'UNDER' = prediction.selection.toUpperCase().includes('UNDER')
          ? 'UNDER'
          : 'OVER';
        settleRes = ExactSettlementEngine.settleOverUnder(
          totalGoals,
          prediction.line ?? 2.5,
          prediction.marketOdds,
          side,
          stakeUnits
        );
      } else if (prediction.market === 'BTTS') {
        const side: 'YES' | 'NO' = prediction.selection.toUpperCase().includes('NO') ? 'NO' : 'YES';
        settleRes = ExactSettlementEngine.settleBtts(
          homeGoals,
          awayGoals,
          prediction.marketOdds,
          side,
          stakeUnits
        );
      } else {
        throw new Error(`Unsupported market '${prediction.market}' in settlement engine.`);
      }
    } catch (e: any) {
      return {
        settled: false,
        settlement: null,
        reason: `SETTLEMENT_MATH_ERROR: ${e.message}`,
      };
    }

    // 8. Calculate Line-Aware CLV
    let clvRecord: CanonicalClvRecord | null = null;
    let clvVal: number | null = null;

    if (result.closingOdds && result.closingOdds > 1.0) {
      // Check if closing line matches prediction line for AH/OU
      const linesMatch =
        prediction.line === null ||
        result.closingLine === undefined ||
        result.closingLine === null ||
        Math.abs(prediction.line - result.closingLine) < 1e-4;

      if (linesMatch) {
        const clvAbs = Number((prediction.marketOdds - result.closingOdds).toFixed(4));
        const clvPct = Number(((prediction.marketOdds / result.closingOdds) - 1).toFixed(4));
        clvVal = clvPct;

        clvRecord = {
          predictionOdds: prediction.marketOdds,
          predictionOddsTimestamp: prediction.oddsTimestamp,
          closingOdds: result.closingOdds,
          closingOddsTimestamp: result.resultReceivedAt || nowIso,
          closingLine: result.closingLine !== undefined ? result.closingLine : prediction.line,
          clvAbsolute: clvAbs,
          clvPercentage: clvPct,
          clvStatus: 'AVAILABLE',
          lineMatch: true,
          benchmarkSource: 'Pinnacle',
        };
      } else {
        // Line moved: apples-to-apples price comparison is unavailable
        clvRecord = {
          predictionOdds: prediction.marketOdds,
          predictionOddsTimestamp: prediction.oddsTimestamp,
          closingOdds: result.closingOdds,
          closingOddsTimestamp: result.resultReceivedAt || nowIso,
          closingLine: result.closingLine !== undefined ? result.closingLine : null,
          clvAbsolute: null,
          clvPercentage: null,
          clvStatus: 'UNAVAILABLE',
          lineMatch: false,
          benchmarkSource: 'Pinnacle',
        };
      }
    } else {
      clvRecord = {
        predictionOdds: prediction.marketOdds,
        predictionOddsTimestamp: prediction.oddsTimestamp,
        closingOdds: null,
        closingOddsTimestamp: null,
        closingLine: null,
        clvAbsolute: null,
        clvPercentage: null,
        clvStatus: 'UNAVAILABLE',
        lineMatch: true,
        benchmarkSource: 'Pinnacle',
      };
    }

    // 9. Check for Revision if already had settlement
    let revisions = prediction.revisions || [];
    if (prediction.settlement && options?.forceRecalculate) {
      const prev = prediction.settlement;
      if (prev.outcome !== settleRes.outcome || prev.profitUnits !== settleRes.profit) {
        const rev: SettlementRevision = {
          revisionId: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          previousOutcome: prev.outcome,
          newOutcome: settleRes.outcome,
          previousProfitUnits: prev.profitUnits,
          newProfitUnits: settleRes.profit,
          timestampUtc: nowIso,
          source: result.provider || 'api-football',
          reason: options?.revisionReason || 'Authoritative match result correction',
        };
        revisions = [...revisions, rev];
      }
    }

    // 10. Construct Settlement Record
    const settlement: CanonicalSettlementRecord = {
      settlementId: `stl_${prediction.predictionId}`,
      predictionId: prediction.predictionId,
      canonicalFixtureId: prediction.canonicalFixtureId,
      homeGoals,
      awayGoals,
      totalGoals,
      matchStatus: normStatus,
      outcome: settleRes.outcome,
      stakeUnits,
      profitUnits: settleRes.profit,
      returnUnits: settleRes.returnAmount,
      closingOdds: result.closingOdds || null,
      closingLine: result.closingLine !== undefined ? result.closingLine : prediction.line,
      clv: clvVal,
      settledAt: nowIso,
      resultProvider: result.provider || 'api-football',
      resultReceivedAt: result.resultReceivedAt || nowIso,
      revisions,
    };

    this.persistSettlement(prediction, settlement, clvRecord);
    return { settled: true, settlement };
  }

  /**
   * Persists settlement state into canonical ledger and daily prediction ledger.
   */
  private static persistSettlement(
    prediction: CanonicalPredictionRecord,
    settlement: CanonicalSettlementRecord,
    clvRecord: CanonicalClvRecord | null
  ): void {
    const ledger = CanonicalBetLedgerService.loadLedger();
    prediction.status = settlement.outcome === 'VOID' ? 'VOID' : 'SETTLED';
    prediction.settlement = settlement;
    prediction.clvRecord = clvRecord;
    prediction.updatedAt = settlement.settledAt;
    ledger[prediction.predictionId] = prediction;
    CanonicalBetLedgerService.saveLedger(ledger);

    // Also update DailyPredictionLedgerService for complete compatibility
    try {
      DailyPredictionLedgerService.settlePrediction(prediction.predictionId, {
        outcome: settlement.outcome === 'CANCELLED' ? 'VOID' : settlement.outcome,
        profitUnits: settlement.profitUnits,
        homeGoals: settlement.homeGoals,
        awayGoals: settlement.awayGoals,
        closingOdds: settlement.closingOdds,
        clv: settlement.clv,
        settledAt: settlement.settledAt,
      });
    } catch {}
  }

  /**
   * Settles a batch of predictions against a map of authoritative results.
   */
  public static settleBatch(
    resultsMap: Map<string, MatchResultInput>,
    options?: { nowMs?: number }
  ): { checkedCount: number; settledCount: number; voidCount: number; skippedCount: number } {
    const predictions = CanonicalBetLedgerService.getAllPredictions();
    let checkedCount = 0;
    let settledCount = 0;
    let voidCount = 0;
    let skippedCount = 0;

    for (const pred of predictions) {
      if (pred.status === 'SETTLED' || pred.status === 'VOID') continue;

      const res =
        resultsMap.get(pred.canonicalFixtureId) ||
        (pred.fixtureId ? resultsMap.get(pred.fixtureId) : undefined);
      if (!res) {
        skippedCount++;
        continue;
      }

      checkedCount++;
      const outcome = this.settlePrediction(pred, res, options);
      if (outcome.settled) {
        if (outcome.settlement?.outcome === 'VOID') voidCount++;
        else settledCount++;
      } else {
        skippedCount++;
      }
    }

    return { checkedCount, settledCount, voidCount, skippedCount };
  }
}
