// ============================================================================
// PRODUCTION SETTLEMENT ENGINE SERVICE
// ============================================================================
// Location: src/lib/ledger/productionSettlementService.ts
//
// Invariants:
// 1. Reuses authoritative ExactSettlementEngine for AH quarter-lines, OU, and BTTS.
// 2. Only settles confirmed final fixtures (FT, AET, PEN).
// 3. Postponed matches remain unsettled (AWAITING_RESULT).
// 4. Cancelled/abandoned fixtures become VOID (profit = 0.0).
// 5. Incomplete results flag DATA_ERROR. Never guesses.
// 6. Idempotent: Settled predictions can never be settled twice.
// ============================================================================

import { ExactSettlementEngine, SettlementResult } from '@/lib/research/settlement/exactSettlement';
import {
  HighConfidenceLedgerEntry,
  SettlementDetails,
  SettlementOutcome,
} from './types';
import { DurableLedgerStore } from './durableLedgerStore';
import { DailyPerformanceService } from './dailyPerformanceService';
import { PredictionArchiveService } from '@/lib/archive/predictionArchiveService';

export interface AuthoritativeMatchResult {
  fixtureId: string;
  status: 'FT' | 'AET' | 'PEN' | 'PST' | 'CANC' | 'ABD' | 'NS' | 'LIVE' | string;
  homeGoals: number | null;
  awayGoals: number | null;
  provider?: string;
  receivedAtUtc?: string;
  closingOdds?: number;
}

export interface SettlementBatchReport {
  timestampUtc: string;
  checkedCount: number;
  settledCount: number;
  voidCount: number;
  skippedCount: number;
  errorCount: number;
  settledLedgerIds: string[];
}

export class ProductionSettlementService {
  /**
   * Settles an individual high-confidence ledger entry against an authoritative match result.
   */
  public static async settleEntry(
    entry: HighConfidenceLedgerEntry,
    result: AuthoritativeMatchResult,
    options?: { nowMs?: number }
  ): Promise<{ settled: boolean; outcome?: SettlementOutcome; reason?: string }> {
    // 1. Idempotency Check: Cannot settle already settled bets
    if (entry.status === 'SETTLED' || entry.settlementStatus !== null) {
      return { settled: false, reason: 'ALREADY_SETTLED' };
    }

    // Invariant: Cannot settle before kickoff time
    if (entry.kickoffUtc) {
      const kickMs = new Date(entry.kickoffUtc).getTime();
      const currentMs = options?.nowMs ?? Date.now();
      if (!isNaN(kickMs) && currentMs < kickMs) {
        return { settled: false, reason: 'KICKOFF_NOT_REACHED: Cannot settle prediction before kickoff timestamp' };
      }
    }

    // Invariant (Gate 6): Cannot settle before match result timestamp
    if (result.receivedAtUtc) {
      const resultMs = new Date(result.receivedAtUtc).getTime();
      const currentMs = options?.nowMs ?? Date.now();
      if (!isNaN(resultMs) && currentMs < resultMs) {
        return { settled: false, reason: 'RESULT_TIMESTAMP_VIOLATION: Settlement timestamp cannot precede result arrival' };
      }
    }

    const normStatus = result.status?.toUpperCase() || 'UNKNOWN';

    // 2. Postponed Match Gate: Match has not been played yet
    if (normStatus === 'PST' || normStatus === 'POSTPONED') {
      return { settled: false, reason: 'MATCH_POSTPONED: Postponed match does not settle' };
    }

    // 3. Cancelled / Abandoned Match: Settle as VOID
    if (normStatus === 'CANC' || normStatus === 'CANCELLED' || normStatus === 'ABD' || normStatus === 'ABANDONED') {
      const nowIso = new Date().toISOString();
      const settlement: SettlementDetails = {
        settlementId: `stl_void_${entry.ledgerId}`,
        ledgerId: entry.ledgerId,
        signalId: entry.signalId,
        fixtureId: entry.fixtureId,
        homeGoals: result.homeGoals ?? 0,
        awayGoals: result.awayGoals ?? 0,
        finalStatus: normStatus,
        outcome: 'VOID',
        profitUnits: 0.0,
        returnUnits: entry.stakeUnits, // Stake returned
        closingOdds: entry.odds,
        closingProbability: entry.modelProbability,
        clv: 0.0,
        settledAt: nowIso,
        resultProvider: result.provider || 'api-football',
        resultReceivedAt: result.receivedAtUtc || nowIso,
        resultVersion: 'v1.0',
      };

      await DurableLedgerStore.recordSettlement(settlement);

      DurableLedgerStore.logEvent({
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ledgerId: entry.ledgerId,
        signalId: entry.signalId,
        fromState: entry.status,
        toState: 'SETTLED',
        reason: `Match cancelled or abandoned. Settled as VOID with stake returned.`,
        timestampUtc: nowIso,
        actor: 'SETTLEMENT_ENGINE',
      });

      return { settled: true, outcome: 'VOID' };
    }

    // 4. Incomplete Match Check (Not finished yet)
    const isFinal = normStatus === 'FT' || normStatus === 'AET' || normStatus === 'PEN' || normStatus === 'FINAL' || normStatus === 'FINISHED';
    if (!isFinal) {
      return { settled: false, reason: `MATCH_NOT_FINAL: Match status '${normStatus}' is not final` };
    }

    // 5. Missing Goals / Data Error Check
    if (result.homeGoals === null || result.awayGoals === null || isNaN(result.homeGoals) || isNaN(result.awayGoals)) {
      entry.status = 'DATA_ERROR';
      entry.rejectionReason = 'MISSING_RESULT_GOALS: Match marked final but score is null or invalid';
      const ledger = DurableLedgerStore.loadLedger();
      ledger[entry.ledgerId] = entry;
      DurableLedgerStore.saveLedger(ledger);

      return { settled: false, reason: 'DATA_ERROR: Incomplete score data' };
    }

    const homeGoals = result.homeGoals;
    const awayGoals = result.awayGoals;
    const totalGoals = homeGoals + awayGoals;

    // 6. Execute Authoritative Settlement via ExactSettlementEngine
    let settleRes: SettlementResult;
    try {
      if (entry.market === 'AH') {
        let side: 'HOME' | 'AWAY' = 'HOME';
        const selLower = entry.selection.toLowerCase();
        if (selLower.includes('away') || (entry.awayTeam && selLower.includes(entry.awayTeam.toLowerCase()))) {
          side = 'AWAY';
        } else if (selLower.includes('home') || (entry.homeTeam && selLower.includes(entry.homeTeam.toLowerCase()))) {
          side = 'HOME';
        }
        settleRes = ExactSettlementEngine.settleAsianHandicap(
          homeGoals,
          awayGoals,
          entry.line,
          entry.odds,
          side,
          entry.stakeUnits
        );
      } else if (entry.market === 'OU') {
        const side: 'OVER' | 'UNDER' = entry.selection.toUpperCase().includes('UNDER') ? 'UNDER' : 'OVER';
        settleRes = ExactSettlementEngine.settleOverUnder(
          totalGoals,
          entry.line,
          entry.odds,
          side,
          entry.stakeUnits
        );
      } else if (entry.market === 'BTTS') {
        const side: 'YES' | 'NO' = entry.selection.toUpperCase().includes('NO') ? 'NO' : 'YES';
        settleRes = ExactSettlementEngine.settleBtts(
          homeGoals,
          awayGoals,
          entry.odds,
          side,
          entry.stakeUnits
        );
      } else {
        throw new Error(`Unsupported market '${entry.market}' in settlement engine.`);
      }
    } catch (calcErr: any) {
      entry.status = 'DATA_ERROR';
      entry.rejectionReason = `SETTLEMENT_CALCULATION_ERROR: ${calcErr.message}`;
      const ledger = DurableLedgerStore.loadLedger();
      ledger[entry.ledgerId] = entry;
      DurableLedgerStore.saveLedger(ledger);

      return { settled: false, reason: `DATA_ERROR: Calculation error: ${calcErr.message}` };
    }

    // 7. Calculate CLV (Closing Line Value)
    const closingOdds = result.closingOdds || entry.odds;
    const closingProb = closingOdds > 1 ? 1 / closingOdds : entry.modelProbability;
    const clv = Number(((entry.odds / closingOdds) - 1).toFixed(4));

    // 8. Record Settlement
    const nowIso = new Date().toISOString();
    const settlement: SettlementDetails = {
      settlementId: `stl_${entry.ledgerId}`,
      ledgerId: entry.ledgerId,
      signalId: entry.signalId,
      fixtureId: entry.fixtureId,
      homeGoals,
      awayGoals,
      finalStatus: normStatus,
      outcome: settleRes.outcome,
      profitUnits: settleRes.profit,
      returnUnits: settleRes.returnAmount,
      closingOdds,
      closingProbability: closingProb,
      clv,
      settledAt: nowIso,
      resultProvider: result.provider || 'api-football',
      resultReceivedAt: result.receivedAtUtc || nowIso,
      resultVersion: 'v1.0',
    };

    await DurableLedgerStore.recordSettlement(settlement);

    // 9. Log Transition Event
    DurableLedgerStore.logEvent({
      eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ledgerId: entry.ledgerId,
      signalId: entry.signalId,
      fromState: entry.status,
      toState: 'SETTLED',
      reason: `Settled as ${settleRes.outcome} (${homeGoals}-${awayGoals}). Profit: ${settleRes.profit > 0 ? '+' : ''}${settleRes.profit}u.`,
      timestampUtc: nowIso,
      actor: 'SETTLEMENT_ENGINE',
    });

    // 10. Update Daily Performance Aggregation
    const matchDate = entry.kickoffUtc.slice(0, 10);
    await DailyPerformanceService.recalculateDailySummary(matchDate);

    // 11. Synchronize to PredictionArchive if corresponding record exists
    try {
      await PredictionArchiveService.settleArchivedPrediction(entry.signalId, {
        settlementId: `stl_${entry.ledgerId}`,
        outcome: settleRes.outcome,
        profitUnits: settleRes.profit,
        stakeUnits: entry.stakeUnits,
        returnUnits: settleRes.returnAmount,
        homeGoals,
        awayGoals,
        finalStatus: normStatus,
        closingOdds,
        clv,
        settledAt: nowIso,
        resultProvider: result.provider || 'api-football',
      });
    } catch (e) {
      // Non-blocking fallback
    }

    return { settled: true, outcome: settleRes.outcome };
  }

  /**
   * Settles all unsettled archived predictions for completed fixtures in results map.
   */
  public static async settleArchiveBatch(
    resultsMap: Map<string, AuthoritativeMatchResult>
  ): Promise<{ settledCount: number; voidCount: number; errorCount: number }> {
    const archive = PredictionArchiveService.loadArchive();
    const unsettled = Object.values(archive).filter(
      (r) => r.status !== 'SETTLED' && r.status !== 'VOID'
    );

    let settledCount = 0;
    let voidCount = 0;
    let errorCount = 0;

    for (const record of unsettled) {
      const matchRes = resultsMap.get(record.fixtureId);
      if (!matchRes) continue;

      const normStatus = matchRes.status?.toUpperCase() || 'UNKNOWN';
      if (normStatus === 'PST' || normStatus === 'POSTPONED') continue;

      const nowIso = new Date().toISOString();

      if (normStatus === 'CANC' || normStatus === 'CANCELLED' || normStatus === 'ABD' || normStatus === 'ABANDONED') {
        await PredictionArchiveService.settleArchivedPrediction(record.predictionId, {
          settlementId: `stl_void_${record.predictionId}`,
          outcome: 'VOID',
          profitUnits: 0.0,
          stakeUnits: 1.0,
          returnUnits: 1.0,
          homeGoals: matchRes.homeGoals ?? 0,
          awayGoals: matchRes.awayGoals ?? 0,
          finalStatus: normStatus,
          closingOdds: record.marketOdds,
          clv: 0.0,
          settledAt: nowIso,
          resultProvider: matchRes.provider || 'api-football',
        });
        voidCount++;
        settledCount++;
        continue;
      }

      const isFinal = normStatus === 'FT' || normStatus === 'AET' || normStatus === 'PEN' || normStatus === 'FINAL' || normStatus === 'FINISHED';
      if (!isFinal) continue;

      if (matchRes.homeGoals === null || matchRes.awayGoals === null || isNaN(matchRes.homeGoals) || isNaN(matchRes.awayGoals)) {
        errorCount++;
        continue;
      }

      const homeGoals = matchRes.homeGoals;
      const awayGoals = matchRes.awayGoals;
      const totalGoals = homeGoals + awayGoals;

      let settleRes: SettlementResult;
      try {
        if (record.market === 'AH') {
          let side: 'HOME' | 'AWAY' = 'HOME';
          const selLower = record.selection.toLowerCase();
          if (selLower.includes('away') || (record.awayTeam && selLower.includes(record.awayTeam.toLowerCase()))) {
            side = 'AWAY';
          }
          settleRes = ExactSettlementEngine.settleAsianHandicap(
            homeGoals,
            awayGoals,
            record.line,
            record.marketOdds,
            side,
            1.0
          );
        } else if (record.market === 'OU') {
          const side: 'OVER' | 'UNDER' = record.selection.toUpperCase().includes('UNDER') ? 'UNDER' : 'OVER';
          settleRes = ExactSettlementEngine.settleOverUnder(
            totalGoals,
            record.line,
            record.marketOdds,
            side,
            1.0
          );
        } else if (record.market === 'BTTS') {
          const side: 'YES' | 'NO' = record.selection.toUpperCase().includes('NO') ? 'NO' : 'YES';
          settleRes = ExactSettlementEngine.settleBtts(
            homeGoals,
            awayGoals,
            record.marketOdds,
            side,
            1.0
          );
        } else {
          continue;
        }
      } catch (err) {
        errorCount++;
        continue;
      }

      const closingOdds = matchRes.closingOdds || record.marketOdds;
      const clv = Number(((record.marketOdds / closingOdds) - 1).toFixed(4));

      await PredictionArchiveService.settleArchivedPrediction(record.predictionId, {
        settlementId: `stl_${record.predictionId}`,
        outcome: settleRes.outcome,
        profitUnits: settleRes.profit,
        stakeUnits: 1.0,
        returnUnits: settleRes.returnAmount,
        homeGoals,
        awayGoals,
        finalStatus: normStatus,
        closingOdds,
        clv,
        settledAt: nowIso,
        resultProvider: matchRes.provider || 'api-football',
      });

      settledCount++;
      const matchDate = record.kickoffTimestamp.slice(0, 10);
      await DailyPerformanceService.recalculateDailySummary(matchDate);
    }

    return { settledCount, voidCount, errorCount };
  }

  /**
   * Settles all unsettled ledger entries whose matches have completed in the provided results map.
   */
  public static async settleBatch(
    results: AuthoritativeMatchResult[]
  ): Promise<SettlementBatchReport> {
    const report: SettlementBatchReport = {
      timestampUtc: new Date().toISOString(),
      checkedCount: 0,
      settledCount: 0,
      voidCount: 0,
      skippedCount: 0,
      errorCount: 0,
      settledLedgerIds: [],
    };

    const resultsMap = new Map<string, AuthoritativeMatchResult>();
    for (const res of results) {
      resultsMap.set(res.fixtureId, res);
    }

    // Settle both HighConfidenceLedger entries and canonical PredictionArchive records
    await this.settleArchiveBatch(resultsMap);

    const ledger = DurableLedgerStore.loadLedger();
    const candidates = Object.values(ledger).filter(
      (e) => e.status === 'LOCKED' || e.status === 'AWAITING_RESULT' || e.status === 'RECORDED'
    );

    report.checkedCount = candidates.length;

    for (const entry of candidates) {
      const matchRes = resultsMap.get(entry.fixtureId);
      if (!matchRes) {
        report.skippedCount++;
        continue;
      }

      const res = await this.settleEntry(entry, matchRes);
      if (res.settled) {
        report.settledCount++;
        report.settledLedgerIds.push(entry.ledgerId);
        if (res.outcome === 'VOID') {
          report.voidCount++;
        }
      } else if (res.reason?.startsWith('DATA_ERROR')) {
        report.errorCount++;
      } else {
        report.skippedCount++;
      }
    }

    return report;
  }

  /**
   * Automatically discovers unsettled bets, queries authoritative provider scores,
   * and settles completed matches. Safe for crons and background workers.
   */
  public static async settlePendingBets(nowMs: number = Date.now()): Promise<SettlementBatchReport> {
    const { HighConfidenceLedgerService } = await import('./highConfidenceLedgerService');
    await HighConfidenceLedgerService.lockBetsForKickoff(nowMs);

    const ledger = DurableLedgerStore.loadLedger();
    const candidates = Object.values(ledger).filter(
      (e) => e.status === 'LOCKED' || e.status === 'AWAITING_RESULT' || e.status === 'RECORDED'
    );

    if (candidates.length === 0) {
      return {
        timestampUtc: new Date().toISOString(),
        checkedCount: 0,
        settledCount: 0,
        voidCount: 0,
        skippedCount: 0,
        errorCount: 0,
        settledLedgerIds: [],
      };
    }

    const results: AuthoritativeMatchResult[] = [];
    const uniqueFixtures = new Map<string, typeof candidates[0]>();
    const EXPECTED_MATCH_DURATION_MS = 100 * 60 * 1000; // 100 minutes from kickoff

    for (const e of candidates) {
      const kickMs = new Date(e.kickoffUtc).getTime();
      // Guardrail 5: Only poll fixtures whose expected final time has elapsed
      if (!isNaN(kickMs) && nowMs < kickMs + EXPECTED_MATCH_DURATION_MS) {
        // Still before or during match: skip querying API-Football
        continue;
      }
      uniqueFixtures.set(e.fixtureId, e);
    }

    if (uniqueFixtures.size === 0) {
      return {
        timestampUtc: new Date().toISOString(),
        checkedCount: candidates.length,
        settledCount: 0,
        voidCount: 0,
        skippedCount: candidates.length,
        errorCount: 0,
        settledLedgerIds: [],
      };
    }

    try {
      const { apiFootballClient } = await import('@/lib/apis/apifootball');
      const { logCall } = await import('@/lib/providers/quotaManager');

      for (const [fixtureId, entry] of uniqueFixtures.entries()) {
        try {
          const numericId = parseInt(entry.fixtureId.replace(/\D/g, ''), 10);
          if (numericId && !isNaN(numericId)) {
            const startReq = Date.now();
            const apiRes = await apiFootballClient.getFixtureById(numericId);
            await logCall('apifootball', 'fixtures', Date.now() - startReq, 200, {
              reason: 'RESULT_SETTLEMENT',
              fixtureId,
              status: apiRes?.fixture?.status?.short,
            }).catch(() => {});

            if (apiRes?.fixture) {
              results.push({
                fixtureId,
                status: apiRes.fixture.status?.short || 'UNKNOWN',
                homeGoals: apiRes.goals?.home ?? null,
                awayGoals: apiRes.goals?.away ?? null,
                provider: 'api-football-pro',
                receivedAtUtc: new Date().toISOString(),
              });
            }
          }
        } catch (fErr: any) {
          console.warn(`[ProductionSettlementService] Error fetching fixture ${fixtureId}:`, fErr?.message);
        }
      }
    } catch (importErr: any) {
      console.warn('[ProductionSettlementService] Could not import apiFootballClient:', importErr?.message);
    }

    return await this.settleBatch(results);
  }
}
