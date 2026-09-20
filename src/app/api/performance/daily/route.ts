// ============================================================================
// DAILY PERFORMANCE API ROUTE
// ============================================================================
// Location: src/app/api/performance/daily/route.ts
//
// Answers:
//   "Hari ini ada berapa pertandingan yang menghasilkan qualified high-confidence signals,
//    berapa virtual bets yang settled, berapa WIN/LOSS/PUSH, berapa total units staked,
//    berapa profit/loss, dan berapa yield/ROI?"
//
// Query parameters supported:
//   - date: YYYY-MM-DD (defaults to current UTC day)
//   - market: AH | OU | BTTS
//   - league: string (e.g. "Premier League")
//   - confidence_min: number (e.g. 70.0)
//   - confidence_max: number
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';
import { HighConfidenceLedgerService } from '@/lib/ledger/highConfidenceLedgerService';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';
import { HIGH_CONFIDENCE_THRESHOLD } from '@/lib/ledger/constants';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
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
    console.error('[API /api/performance/daily] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal error calculating daily performance',
      },
      { status: 500 }
    );
  }
}
