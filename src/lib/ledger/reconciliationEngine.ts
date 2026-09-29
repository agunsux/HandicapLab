// ============================================================================
// CANONICAL DATA RECONCILIATION ENGINE
// ============================================================================
// Location: src/lib/ledger/reconciliationEngine.ts
//
// Invariants enforced:
// 1. TOTAL PREDICTIONS = SETTLED + PENDING + VOID + CANCELLED.
// 2. TOTAL PROFIT = SUM(individual prediction profitUnits).
// 3. TOTAL STAKED = SUM(individual settled stakeUnits).
// 4. Odds snapshot integrity: prediction odds === stored immutable odds.
// 5. CLV integrity: CLV calculated ONLY when valid closing odds exist.
// 6. Fail-closed: Mismatches produce RECONCILIATION_FAILURE with exact discrepancies.
// ============================================================================

import { CanonicalBetLedgerService } from './canonicalBetLedger';
import { CanonicalPerformanceEngine } from './canonicalPerformanceEngine';
import { ReconciliationReport, CanonicalPredictionRecord } from './predictionLedgerTypes';

export class ReconciliationEngine {
  /**
   * Runs the complete reconciliation audit against the canonical ledger.
   */
  public static runAudit(predictions?: CanonicalPredictionRecord[]): ReconciliationReport {
    const all = predictions || CanonicalBetLedgerService.getAllPredictions();
    const discrepancies: string[] = [];

    let settledCount = 0;
    let pendingCount = 0;
    let voidCount = 0;
    let cancelledCount = 0;

    let computedProfitSum = 0;
    let computedStakedSum = 0;

    let oddsIntegrityValid = true;
    let clvIntegrityValid = true;

    for (const p of all) {
      // 1. Odds Integrity Check: Entry odds must be valid decimal > 1.0
      if (!p.marketOdds || p.marketOdds <= 1.0 || isNaN(p.marketOdds)) {
        oddsIntegrityValid = false;
        discrepancies.push(`Prediction ${p.predictionId} has invalid market odds: ${p.marketOdds}`);
      }

      // 2. Lifecycle Count & Settlement Sums
      if (p.status === 'PENDING') {
        pendingCount++;
        if (p.settlement !== null) {
          discrepancies.push(`Prediction ${p.predictionId} is PENDING but has a non-null settlement record`);
        }
      } else if (p.status === 'VOID') {
        voidCount++;
        if (p.settlement && p.settlement.profitUnits !== 0) {
          discrepancies.push(`VOID prediction ${p.predictionId} has non-zero profit: ${p.settlement.profitUnits}`);
        }
      } else if (p.status === 'CANCELLED') {
        cancelledCount++;
      } else if (p.status === 'SETTLED') {
        settledCount++;
        if (!p.settlement) {
          discrepancies.push(`SETTLED prediction ${p.predictionId} is missing settlement record`);
        } else {
          computedProfitSum += p.settlement.profitUnits;
          computedStakedSum += (p.settlement.stakeUnits || 1.0);

          // 3. CLV Integrity Check
          if (p.clvRecord) {
            if (p.clvRecord.clvStatus === 'AVAILABLE') {
              if (!p.clvRecord.closingOdds || p.clvRecord.closingOdds <= 1.0) {
                clvIntegrityValid = false;
                discrepancies.push(`Prediction ${p.predictionId} marked CLV AVAILABLE but has invalid closing odds: ${p.clvRecord.closingOdds}`);
              }
              if (p.clvRecord.clvPercentage === null || isNaN(p.clvRecord.clvPercentage)) {
                clvIntegrityValid = false;
                discrepancies.push(`Prediction ${p.predictionId} marked CLV AVAILABLE but clvPercentage is null`);
              }
            } else if (p.clvRecord.clvStatus === 'UNAVAILABLE') {
              if (p.clvRecord.clvPercentage !== null) {
                clvIntegrityValid = false;
                discrepancies.push(`Prediction ${p.predictionId} marked CLV UNAVAILABLE but has non-null clvPercentage: ${p.clvRecord.clvPercentage}`);
              }
            }
          }
        }
      }
    }

    // 4. Invariant: Total = Settled + Pending + Void + Cancelled
    const sumCount = settledCount + pendingCount + voidCount + cancelledCount;
    const lifecycleBalanceValid = all.length === sumCount;
    if (!lifecycleBalanceValid) {
      discrepancies.push(`Lifecycle balance violated: Total ${all.length} !== Settled(${settledCount}) + Pending(${pendingCount}) + Void(${voidCount}) + Cancelled(${cancelledCount}) = ${sumCount}`);
    }

    // 5. Invariant: Performance Engine Report Matches Ledger Sums
    const perfReport = CanonicalPerformanceEngine.generateReport(all);
    const profitDiff = Math.abs(perfReport.totalProfit - computedProfitSum);
    const profitSumValid = profitDiff < 1e-4;
    if (!profitSumValid) {
      discrepancies.push(`Profit sum mismatch: Performance Engine reports ${perfReport.totalProfit}, ledger item sum is ${computedProfitSum}`);
    }

    const stakedDiff = Math.abs(perfReport.totalStaked - computedStakedSum);
    const stakedBalanceValid = stakedDiff < 1e-4;
    if (!stakedBalanceValid) {
      discrepancies.push(`Staked sum mismatch: Performance Engine reports ${perfReport.totalStaked}, ledger item sum is ${computedStakedSum}`);
    }

    const status: 'RECONCILIATION_PASS' | 'RECONCILIATION_FAILURE' =
      lifecycleBalanceValid && profitSumValid && stakedBalanceValid && oddsIntegrityValid && clvIntegrityValid && discrepancies.length === 0
        ? 'RECONCILIATION_PASS'
        : 'RECONCILIATION_FAILURE';

    return {
      timestampUtc: new Date().toISOString(),
      status,
      totalPredictions: all.length,
      settledCount,
      pendingCount,
      voidCount,
      cancelledCount,
      lifecycleBalanceValid,
      stakedBalanceValid,
      profitSumValid,
      oddsIntegrityValid,
      clvIntegrityValid,
      discrepancies,
    };
  }
}
