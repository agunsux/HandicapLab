// ============================================================================
// DAILY PERFORMANCE & REALIZED YIELD AGGREGATION SERVICE
// ============================================================================
// Location: src/lib/ledger/dailyPerformanceService.ts
//
// Invariants:
// 1. Yield canonical definition: total_profit_units / total_staked_units * 100.
//    NEVER calculated as win rate (wins / bets).
// 2. Open exposure (unsettled) is strictly separated from realized yield.
// 3. Multi-dimensional breakdowns: market, confidence band, league, bookmaker.
// 4. Sample size N is always explicitly reported.
// ============================================================================

import {
  HighConfidenceLedgerEntry,
  SettlementDetails,
  DailyPerformanceSummary,
  DimensionPerformance,
  OverallPerformanceReport,
} from './types';
import { DurableLedgerStore } from './durableLedgerStore';
import { HIGH_CONFIDENCE_THRESHOLD, CONFIDENCE_BANDS } from './constants';
import { PredictionArchiveService } from '@/lib/archive/predictionArchiveService';
import { PredictionArchiveRecord } from '@/lib/archive/types';

export class DailyPerformanceService {
  /**
   * Recalculates and persists daily summary. If dateStr is not provided, defaults to today's UTC date.
   */
  public static async calculateDailySummary(dateStr?: string): Promise<DailyPerformanceSummary> {
    const targetDate = dateStr || new Date().toISOString().slice(0, 10);
    return await this.recalculateDailySummary(targetDate);
  }

  /**
   * Recalculates and persists the daily performance summary for a given UTC date (YYYY-MM-DD).
   */
  public static async recalculateDailySummary(dateStr: string): Promise<DailyPerformanceSummary> {
    const ledger = DurableLedgerStore.loadLedger();
    const settlements = DurableLedgerStore.loadSettlements();

    const dateEntries = Object.values(ledger).filter((e) => e.kickoffUtc.startsWith(dateStr));

    let qualified = 0;
    let recorded = 0;
    let locked = 0;
    let settled = 0;

    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let halfWins = 0;
    let halfLosses = 0;
    let voids = 0;

    let totalStakeUnits = 0;
    let totalProfitUnits = 0;
    let sumOdds = 0;
    let sumConfidence = 0;

    let openBets = 0;

    for (const entry of dateEntries) {
      qualified++;
      if (entry.status !== 'REJECTED') {
        recorded++;
      }
      if (entry.status === 'LOCKED' || entry.status === 'AWAITING_RESULT' || entry.status === 'SETTLED') {
        locked++;
      }

      if (entry.status === 'RECORDED' || entry.status === 'LOCKED' || entry.status === 'AWAITING_RESULT') {
        openBets++;
      } else if (entry.status === 'SETTLED') {
        const settlement = settlements[entry.ledgerId];
        if (settlement) {
          settled++;
          totalStakeUnits += entry.stakeUnits;
          totalProfitUnits += settlement.profitUnits;
          sumOdds += entry.odds;
          sumConfidence += entry.confidenceScore;

          switch (settlement.outcome) {
            case 'WIN':
              wins++;
              break;
            case 'HALF_WIN':
              halfWins++;
              break;
            case 'PUSH':
              pushes++;
              break;
            case 'HALF_LOSS':
              halfLosses++;
              break;
            case 'LOSS':
              losses++;
              break;
            case 'VOID':
              voids++;
              break;
          }
        }
      }
    }

    const yieldPct = totalStakeUnits > 0
      ? Number(((totalProfitUnits / totalStakeUnits) * 100).toFixed(2))
      : 0.0;

    const averageOdds = settled > 0 ? Number((sumOdds / settled).toFixed(3)) : 0.0;
    const averageConfidence = settled > 0 ? Number((sumConfidence / settled).toFixed(2)) : 0.0;
    const strikeRatePct = settled > 0
      ? Number((((wins + 0.5 * halfWins) / settled) * 100).toFixed(2))
      : 0.0;

    const summary: DailyPerformanceSummary = {
      date: dateStr,
      timezone: 'UTC',
      threshold: HIGH_CONFIDENCE_THRESHOLD,
      qualified,
      recorded,
      locked,
      settled,
      wins,
      losses,
      pushes,
      halfWins,
      halfLosses,
      voids,
      stakeUnits: Number(totalStakeUnits.toFixed(2)),
      profitUnits: Number(totalProfitUnits.toFixed(4)),
      yieldPct,
      openBets,
      openStakeUnits: Number((openBets * 1.0).toFixed(2)),
      averageOdds,
      averageConfidence,
      strikeRatePct,
    };

    await DurableLedgerStore.recordDailySummary(summary);
    return summary;
  }

  /**
   * Computes a multi-dimension breakdown for a set of settled entries.
   */
  public static computeDimensionPerformance(
    entries: HighConfidenceLedgerEntry[],
    settlements: Record<string, SettlementDetails>,
    dimensionKey: string,
    label: string
  ): DimensionPerformance {
    let settledBets = 0;
    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let halfWins = 0;
    let halfLosses = 0;
    let stakeUnits = 0;
    let profitUnits = 0;
    let sumOdds = 0;
    let sumConfidence = 0;

    for (const entry of entries) {
      const settlement = settlements[entry.ledgerId];
      if (!settlement) continue;

      settledBets++;
      stakeUnits += entry.stakeUnits;
      profitUnits += settlement.profitUnits;
      sumOdds += entry.odds;
      sumConfidence += entry.confidenceScore;

      if (settlement.outcome === 'WIN') wins++;
      else if (settlement.outcome === 'HALF_WIN') halfWins++;
      else if (settlement.outcome === 'PUSH') pushes++;
      else if (settlement.outcome === 'HALF_LOSS') halfLosses++;
      else if (settlement.outcome === 'LOSS') losses++;
    }

    const yieldPct = stakeUnits > 0
      ? Number(((profitUnits / stakeUnits) * 100).toFixed(2))
      : 0.0;

    return {
      dimensionKey,
      label,
      settledBets,
      wins,
      losses,
      pushes,
      halfWins,
      halfLosses,
      stakeUnits: Number(stakeUnits.toFixed(2)),
      profitUnits: Number(profitUnits.toFixed(4)),
      yieldPct,
      avgOdds: settledBets > 0 ? Number((sumOdds / settledBets).toFixed(3)) : 0.0,
      avgConfidence: settledBets > 0 ? Number((sumConfidence / settledBets).toFixed(2)) : 0.0,
    };
  }

  /**
   * Generates the comprehensive overall performance report across all horizons and dimensions.
   */
  public static async getOverallReport(options: { nowMs?: number } = {}): Promise<OverallPerformanceReport> {
    const nowMs = options.nowMs || Date.now();
    const todayStr = new Date(nowMs).toISOString().slice(0, 10);
    const yesterdayStr = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const ledger = DurableLedgerStore.loadLedger();
    const settlements = DurableLedgerStore.loadSettlements();
    const allEntries = Object.values(ledger);

    // Ensure today and yesterday summaries are updated
    const today = await this.recalculateDailySummary(todayStr);
    const yesterday = await this.recalculateDailySummary(yesterdayStr);

    // Filter horizons
    const sevenDaysAgoStr = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const thirtyDaysAgoStr = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const settledEntries = allEntries.filter((e) => e.status === 'SETTLED' && settlements[e.ledgerId]);
    const sevenDaysEntries = settledEntries.filter((e) => e.kickoffUtc >= sevenDaysAgoStr);
    const thirtyDaysEntries = settledEntries.filter((e) => e.kickoffUtc >= thirtyDaysAgoStr);

    const last7Days = this.computeDimensionPerformance(sevenDaysEntries, settlements, '7d', 'Last 7 Days');
    const last30Days = this.computeDimensionPerformance(thirtyDaysEntries, settlements, '30d', 'Last 30 Days');
    const allTime = this.computeDimensionPerformance(settledEntries, settlements, 'all', 'All Time');

    // Slices by Market
    const byMarket: DimensionPerformance[] = ['AH', 'OU', 'BTTS'].map((m) => {
      const mEntries = settledEntries.filter((e) => e.market === m);
      return this.computeDimensionPerformance(mEntries, settlements, m, m);
    });

    // Slices by Confidence Band
    const byConfidenceBand: DimensionPerformance[] = CONFIDENCE_BANDS.map((band) => {
      const bEntries = settledEntries.filter(
        (e) => e.confidenceScore >= band.min && e.confidenceScore <= band.max
      );
      return this.computeDimensionPerformance(bEntries, settlements, band.id, band.label);
    });

    // Slices by League (top leagues with settled bets)
    const leaguesSet = new Set(settledEntries.map((e) => e.competitionName));
    const byLeague: DimensionPerformance[] = Array.from(leaguesSet).map((leagueName) => {
      const lEntries = settledEntries.filter((e) => e.competitionName === leagueName);
      return this.computeDimensionPerformance(lEntries, settlements, leagueName, leagueName);
    });

    // Recent settlements (latest 10)
    const recentSettlements = settledEntries
      .sort((a, b) => new Date(settlements[b.ledgerId]?.settledAt || 0).getTime() - new Date(settlements[a.ledgerId]?.settledAt || 0).getTime())
      .slice(0, 10)
      .map((e) => {
        const s = settlements[e.ledgerId];
        return {
          ledgerId: e.ledgerId,
          fixture: `${e.homeTeam} vs ${e.awayTeam}`,
          market: e.market,
          line: e.line,
          selection: e.selection,
          odds: e.odds,
          score: `${s.homeGoals}-${s.awayGoals}`,
          outcome: s.outcome,
          profitUnits: s.profitUnits,
          settledAt: s.settledAt,
        };
      });

    const openEntries = allEntries.filter(
      (e) => e.status === 'RECORDED' || e.status === 'LOCKED' || e.status === 'AWAITING_RESULT'
    );

    return {
      generatedAtUtc: new Date(nowMs).toISOString(),
      canonicalDomain: 'salmo.dev',
      threshold: HIGH_CONFIDENCE_THRESHOLD,
      totalQualified: allEntries.length,
      totalSettled: settledEntries.length,
      totalOpenBets: openEntries.length,
      openStakeUnits: Number((openEntries.length * 1.0).toFixed(2)),
      totalStakedUnits: allTime.stakeUnits,
      totalProfitUnits: allTime.profitUnits,
      realizedYieldPct: allTime.yieldPct,
      today,
      yesterday,
      last7Days,
      last30Days,
      allTime,
      byMarket,
      byConfidenceBand,
      byLeague,
      recentSettlements,
    };
  }

  /**
   * Computes comprehensive performance windows and multi-dimension slices
   * from the canonical Prediction Archive.
   */
  public static getArchivePerformanceReport(options: { nowMs?: number } = {}) {
    const nowMs = options.nowMs || Date.now();
    const todayStr = new Date(nowMs).toISOString().slice(0, 10);
    const yesterdayStr = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sevenDaysAgoStr = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const thirtyDaysAgoStr = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const archive = PredictionArchiveService.loadArchive();
    const allRecords = Object.values(archive);
    const settledRecords = allRecords.filter((r) => r.settlement !== null);

    const computeSlice = (records: PredictionArchiveRecord[], label: string) => {
      let settledBets = 0;
      let wins = 0;
      let halfWins = 0;
      let pushes = 0;
      let halfLosses = 0;
      let losses = 0;
      let voids = 0;
      let stakeUnits = 0;
      let profitUnits = 0;
      let sumOdds = 0;
      let sumClv = 0;
      let clvCount = 0;

      for (const r of records) {
        if (!r.settlement) continue;
        settledBets++;
        stakeUnits += r.settlement.stakeUnits || 1.0;
        profitUnits += r.settlement.profitUnits;
        sumOdds += r.marketOdds;

        if (r.settlement.clv !== undefined && r.settlement.clv !== null) {
          sumClv += r.settlement.clv;
          clvCount++;
        }

        switch (r.settlement.outcome) {
          case 'WIN': wins++; break;
          case 'HALF_WIN': halfWins++; break;
          case 'PUSH': pushes++; break;
          case 'HALF_LOSS': halfLosses++; break;
          case 'LOSS': losses++; break;
          case 'VOID': voids++; break;
        }
      }

      const yieldPct = stakeUnits > 0 ? Number(((profitUnits / stakeUnits) * 100).toFixed(2)) : 0.0;
      const effectiveBets = settledBets - voids;
      const strikeRatePct = effectiveBets > 0
        ? Number((((wins + 0.5 * halfWins) / effectiveBets) * 100).toFixed(2))
        : 0.0;

      return {
        label,
        totalBets: records.length,
        settledBets,
        wins,
        halfWins,
        pushes,
        halfLosses,
        losses,
        voids,
        stakeUnits: Number(stakeUnits.toFixed(2)),
        profitUnits: Number(profitUnits.toFixed(4)),
        yieldPct,
        avgOdds: settledBets > 0 ? Number((sumOdds / settledBets).toFixed(3)) : 0.0,
        avgClvPct: clvCount > 0 ? Number(((sumClv / clvCount) * 100).toFixed(2)) : 0.0,
        strikeRatePct,
      };
    };

    const today = computeSlice(settledRecords.filter((r) => r.kickoffTimestamp.startsWith(todayStr)), 'Today');
    const yesterday = computeSlice(settledRecords.filter((r) => r.kickoffTimestamp.startsWith(yesterdayStr)), 'Yesterday');
    const last7Days = computeSlice(settledRecords.filter((r) => r.kickoffTimestamp >= sevenDaysAgoStr), 'Last 7 Days');
    const last30Days = computeSlice(settledRecords.filter((r) => r.kickoffTimestamp >= thirtyDaysAgoStr), 'Last 30 Days');
    const allTime = computeSlice(settledRecords, 'All Time');

    const byMarket = ['AH', 'OU', 'BTTS'].map((m) =>
      computeSlice(settledRecords.filter((r) => r.market === m), m)
    );

    const leagues = Array.from(new Set(settledRecords.map((r) => r.competition)));
    const byLeague = leagues.map((l) =>
      computeSlice(settledRecords.filter((r) => r.competition === l), l)
    );

    const modelVersions = Array.from(new Set(settledRecords.map((r) => r.modelVersion)));
    const byModelVersion = modelVersions.map((mv) =>
      computeSlice(settledRecords.filter((r) => r.modelVersion === mv), mv)
    );

    const openPredictions = allRecords.filter((r) => r.status === 'ACTIVE' || r.status === 'GENERATED' || r.status === 'KICKED_OFF');

    return {
      generatedAtUtc: new Date(nowMs).toISOString(),
      canonicalDomain: 'salmo.dev' as const,
      totalArchived: allRecords.length,
      totalSettled: settledRecords.length,
      totalOpen: openPredictions.length,
      openStakeUnits: Number((openPredictions.length * 1.0).toFixed(2)),
      allTimeYieldPct: allTime.yieldPct,
      allTimeProfitUnits: allTime.profitUnits,
      allTimeStakeUnits: allTime.stakeUnits,
      windows: {
        today,
        yesterday,
        last7Days,
        last30Days,
        allTime,
      },
      byMarket,
      byLeague,
      byModelVersion,
    };
  }
}
