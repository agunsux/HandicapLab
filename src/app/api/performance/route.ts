// ============================================================================
// HIGH-CONFIDENCE & OVERALL PERFORMANCE API ROUTE
// ============================================================================
// Location: src/app/api/performance/route.ts
//
// Serves:
//   1. Canonical High-Confidence Performance Report across horizons
//      (today, yesterday, 7-day, 30-day, all-time) and dimensions (market, band, league).
//   2. Daily Performance Breakdown when view=daily or action=daily
//      (answers qualified signals, settled bets, WIN/LOSS/PUSH, stake units, P&L, realized yield).
//   3. Backward-compatible paper-trading aggregation if source=paper-trading.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';
import { PerformanceAggregator } from '@/lib/paper-trading/performanceAggregator';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';
import { HIGH_CONFIDENCE_THRESHOLD } from '@/lib/ledger/constants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get('source');
  const view = searchParams.get('view') || searchParams.get('action');

  // 1. If paper-trading is explicitly requested, preserve legacy contract
  if (source === 'paper-trading') {
    try {
      const stats = await PerformanceAggregator.aggregate();
      return NextResponse.json(stats);
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
  }

  // 2. Daily Performance slice (absorbed from /api/performance/daily)
  if (view === 'daily') {
    try {
      const nowIso = new Date().toISOString();
      const dateParam = searchParams.get('date') || nowIso.slice(0, 10);
      const marketFilter = searchParams.get('market')?.toUpperCase();
      const leagueFilter = searchParams.get('league');
      const minConf = searchParams.get('confidence_min') ? parseFloat(searchParams.get('confidence_min')!) : undefined;
      const maxConf = searchParams.get('confidence_max') ? parseFloat(searchParams.get('confidence_max')!) : undefined;

      // Recalculate daily summary for requested date
      const dailySummary = await DailyPerformanceService.recalculateDailySummary(dateParam);

      // If specific market/league/confidence filters are requested, compute tailored slice
      const ledger = DurableLedgerStore.loadLedger();
      const settlements = DurableLedgerStore.loadSettlements();
      let entries = Object.values(ledger).filter((e) => e.kickoffUtc.startsWith(dateParam));

      if (marketFilter) {
        entries = entries.filter((e) => e.market === marketFilter);
      }
      if (leagueFilter) {
        entries = entries.filter((e) => e.competitionName.toLowerCase().includes(leagueFilter.toLowerCase()));
      }
      if (minConf !== undefined) {
        entries = entries.filter((e) => e.confidenceScore >= minConf);
      }
      if (maxConf !== undefined) {
        entries = entries.filter((e) => e.confidenceScore <= maxConf);
      }

      const filteredSlice = DailyPerformanceService.computeDimensionPerformance(
        entries.filter((e) => e.status === 'SETTLED'),
        settlements,
        'custom_filter',
        'Filtered Slice'
      );

      const openEntries = entries.filter(
        (e) => e.status === 'RECORDED' || e.status === 'LOCKED' || e.status === 'AWAITING_RESULT'
      );

      return NextResponse.json({
        success: true,
        date: dateParam,
        timezone: 'UTC',
        threshold: HIGH_CONFIDENCE_THRESHOLD,
        summary: dailySummary,
        filtered: {
          totalEligible: entries.length,
          openBets: openEntries.length,
          openStakeUnits: openEntries.length * 1.0,
          settledMetrics: filteredSlice,
        },
        bets: entries.map((e) => {
          const s = settlements[e.ledgerId];
          return {
            ledgerId: e.ledgerId,
            signalId: e.signalId,
            fixture: `${e.homeTeam} vs ${e.awayTeam}`,
            league: e.competitionName,
            kickoffUtc: e.kickoffUtc,
            market: e.market,
            line: e.line,
            selection: e.selection,
            odds: e.odds,
            confidenceScore: e.confidenceScore,
            modelProbability: e.modelProbability,
            stakeUnits: e.stakeUnits,
            betType: e.betType,
            status: e.status,
            settlementStatus: e.settlementStatus,
            result: s
              ? {
                  homeGoals: s.homeGoals,
                  awayGoals: s.awayGoals,
                  outcome: s.outcome,
                  profitUnits: s.profitUnits,
                  returnUnits: s.returnUnits,
                  clv: s.clv,
                  settledAt: s.settledAt,
                }
              : null,
          };
        }),
      });
    } catch (error: any) {
      console.error('[API /api/performance?view=daily] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Internal error calculating daily performance',
        },
        { status: 500 }
      );
    }
  }

  // 3. Default overall performance report across all horizons
  try {
    const report = await DailyPerformanceService.getOverallReport();
    return NextResponse.json(report);
  } catch (error: any) {
    console.error('[API /api/performance] Error generating performance report:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error retrieving performance report' },
      { status: 500 }
    );
  }
}
