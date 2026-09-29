// ============================================================================
// PERFORMANCE & SETTLEMENTS CANONICAL API ROUTE
// ============================================================================
// Location: src/app/api/performance/route.ts
//
// Consolidated API endpoint for Vercel Hobby serverless limits.
// Serves:
//   1. Canonical Performance (source=canonical or view=canonical)
//   2. Canonical Settlements (view=settlements; rewritten from /api/settlements)
//   3. Canonical Bookmaker breakdown (view=bookmakers; rewritten from /api/performance/bookmakers)
//   4. Canonical Calibration breakdown (view=calibration; rewritten from /api/performance/calibration)
//   5. Canonical Timeseries bankroll curve (view=timeseries; rewritten from /api/performance/timeseries)
//   6. Daily Performance Breakdown (view=daily; rewritten from /api/performance/daily)
//   7. Paper-Trading aggregation (source=paper-trading)
//   8. Overall High-Confidence Performance Report (default)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';
import { PerformanceAggregator } from '@/lib/paper-trading/performanceAggregator';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';
import { HIGH_CONFIDENCE_THRESHOLD } from '@/lib/ledger/constants';
import { CanonicalPerformanceEngine } from '@/lib/ledger/canonicalPerformanceEngine';
import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get('source');
  const view = searchParams.get('view') || searchParams.get('action');

  // 1. Canonical Settlements (rewritten from /api/settlements)
  if (view === 'settlements') {
    try {
      const market = searchParams.get('market')?.toUpperCase();
      const league = searchParams.get('league')?.toLowerCase();
      const outcome = searchParams.get('outcome')?.toUpperCase();
      const limit = parseInt(searchParams.get('limit') || '100', 10);
      const page = parseInt(searchParams.get('page') || '1', 10);

      const all = CanonicalBetLedgerService.getSettledPredictions();

      let filtered = all;
      if (market) {
        filtered = filtered.filter((p) => p.market === market);
      }
      if (league) {
        filtered = filtered.filter(
          (p) =>
            p.league.toLowerCase().includes(league) ||
            p.competition.toLowerCase().includes(league)
        );
      }
      if (outcome) {
        filtered = filtered.filter((p) => p.settlement?.outcome === outcome);
      }

      const total = filtered.length;
      const offset = (page - 1) * limit;
      const paginated = filtered.slice(offset, offset + limit);

      return NextResponse.json({
        success: true,
        source: 'canonical',
        total,
        page,
        limit,
        settlements: paginated.map((p) => ({
          predictionId: p.predictionId,
          canonicalFixtureId: p.canonicalFixtureId,
          fixture: p.fixture,
          league: p.league,
          kickoffTimestamp: p.kickoffTimestamp,
          market: p.market,
          selection: p.selection,
          line: p.line,
          lineType: p.lineType,
          marketOdds: p.marketOdds,
          modelProbability: p.modelProbability,
          fairOdds: p.fairOdds,
          expectedValue: p.expectedValue,
          confidence: p.confidence,
          settlement: p.settlement,
          clvRecord: p.clvRecord,
        })),
      });
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: e.message || 'Failed to fetch settlements' },
        { status: 500 }
      );
    }
  }

  // 2. Canonical Bookmaker breakdown (rewritten from /api/performance/bookmakers)
  if (view === 'bookmakers') {
    try {
      const report = CanonicalPerformanceEngine.generateReport();
      return NextResponse.json({
        success: true,
        source: 'canonical',
        generatedAtUtc: report.generatedAtUtc,
        totalPredictions: report.totalPredictions,
        settledPredictions: report.settledPredictions,
        byBookmaker: report.byBookmaker,
      });
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: e.message || 'Failed to fetch bookmaker performance' },
        { status: 500 }
      );
    }
  }

  // 3. Canonical Calibration breakdown (rewritten from /api/performance/calibration)
  if (view === 'calibration') {
    try {
      const report = CanonicalPerformanceEngine.generateReport();
      return NextResponse.json({
        success: true,
        source: 'canonical',
        generatedAtUtc: report.generatedAtUtc,
        totalPredictions: report.totalPredictions,
        settledPredictions: report.settledPredictions,
        brierScore: report.calibration?.overallBrierScore ?? null,
        calibration: report.calibration,
      });
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: e.message || 'Failed to fetch calibration report' },
        { status: 500 }
      );
    }
  }

  // 4. Canonical Timeseries bankroll curve (rewritten from /api/performance/timeseries)
  if (view === 'timeseries') {
    try {
      const report = CanonicalPerformanceEngine.generateReport();
      const settled = CanonicalBetLedgerService.getSettledPredictions();
      const { curve, drawdown } = CanonicalPerformanceEngine.computeBankrollAndDrawdown(settled);
      return NextResponse.json({
        success: true,
        source: 'canonical',
        generatedAtUtc: report.generatedAtUtc,
        totalSettled: report.settledPredictions,
        roiPct: report.roiPct,
        bankrollCurve: curve,
        drawdown: drawdown,
      });
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: e.message || 'Failed to fetch timeseries performance' },
        { status: 500 }
      );
    }
  }

  // 5. Canonical Full Performance Report (source=canonical or view=canonical)
  if (source === 'canonical' || view === 'canonical') {
    try {
      const report = CanonicalPerformanceEngine.generateReport();
      return NextResponse.json({
        success: true,
        source: 'canonical',
        ...report,
      });
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: e.message || 'Failed to generate canonical report' },
        { status: 500 }
      );
    }
  }

  // 6. Paper-trading aggregation
  if (source === 'paper-trading') {
    try {
      const stats = await PerformanceAggregator.aggregate();
      return NextResponse.json(stats);
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
  }

  // 7. Daily Performance slice (view=daily)
  if (view === 'daily') {
    try {
      const nowIso = new Date().toISOString();
      const dateParam = searchParams.get('date') || nowIso.slice(0, 10);
      const marketFilter = searchParams.get('market')?.toUpperCase();
      const leagueFilter = searchParams.get('league');
      const minConf = searchParams.get('confidence_min') ? parseFloat(searchParams.get('confidence_min')!) : undefined;
      const maxConf = searchParams.get('confidence_max') ? parseFloat(searchParams.get('confidence_max')!) : undefined;

      const dailySummary = await DailyPerformanceService.recalculateDailySummary(dateParam);

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

  // 8. Default overall performance report across all horizons
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