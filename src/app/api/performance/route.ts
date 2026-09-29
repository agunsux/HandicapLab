// ============================================================================
// PERFORMANCE & SETTLEMENTS CANONICAL API ROUTE
// ============================================================================
// Location: src/app/api/performance/route.ts
//
// Consolidated API endpoint for Vercel Hobby serverless limits (max 12 functions).
// Serves:
//   1. Canonical Settlements (view=settlements; rewritten from /api/settlements)
//   2. Canonical Bookmakers (view=bookmakers; rewritten from /api/performance/bookmakers)
//   3. Canonical Calibration (view=calibration; rewritten from /api/performance/calibration)
//   4. Canonical Timeseries (view=timeseries; rewritten from /api/performance/timeseries)
//   5. Markets Breakdown (view=markets; rewritten from /api/performance/markets)
//   6. CLV Breakdown (view=clv; rewritten from /api/performance/clv)
//   7. Leagues Breakdown (view=leagues; rewritten from /api/performance/leagues)
//   8. Canonical Performance (source=canonical or view=canonical)
//   9. Paper-Trading aggregation (source=paper-trading)
//  10. Daily Performance Breakdown (view=daily; rewritten from /api/performance/daily)
//  11. Overall High-Confidence Performance Report (default)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';
import { PerformanceAggregator } from '@/lib/paper-trading/performanceAggregator';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';
import { HIGH_CONFIDENCE_THRESHOLD } from '@/lib/ledger/constants';
import { CanonicalPerformanceEngine } from '@/lib/ledger/canonicalPerformanceEngine';
import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';
import { supabase } from '@/lib/supabase.server';
import { LEAGUE_REGISTRY } from '@/lib/crons/leagueRegistry';

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

  // 5. Markets Breakdown (rewritten from /api/performance/markets)
  if (view === 'markets') {
    try {
      if (source === 'canonical') {
        const report = CanonicalPerformanceEngine.generateReport();
        return NextResponse.json({
          success: true,
          source: 'canonical',
          byMarket: report.byMarket,
        });
      }

      const { data: signals, error } = await supabase
        .from('signals')
        .select('*')
        .not('settled_at', 'is', null);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const priorityALeagues = new Set(
        LEAGUE_REGISTRY.filter((l) => l.validation_priority === 'A').map((l) => l.name)
      );
      const filteredSignals = (signals || []).filter((sig) => sig.league && priorityALeagues.has(sig.league));

      const marketStats: Record<string, {
        market: string;
        bets: number;
        wins: number;
        profitUnits: number;
        clvSum: number;
        clvCount: number;
        modelProbSum: number;
        closingProbSum: number;
        probCount: number;
      }> = {
        asian_handicap: { market: 'Asian Handicap', bets: 0, wins: 0, profitUnits: 0, clvSum: 0, clvCount: 0, modelProbSum: 0, closingProbSum: 0, probCount: 0 },
        over_under: { market: 'Over/Under', bets: 0, wins: 0, profitUnits: 0, clvSum: 0, clvCount: 0, modelProbSum: 0, closingProbSum: 0, probCount: 0 },
        moneyline: { market: 'Moneyline', bets: 0, wins: 0, profitUnits: 0, clvSum: 0, clvCount: 0, modelProbSum: 0, closingProbSum: 0, probCount: 0 },
      };

      filteredSignals.forEach((sig) => {
        const marketKey = (sig.market || '').toLowerCase();
        const stats = marketStats[marketKey] || marketStats['moneyline'];
        stats.bets++;

        const odds = Number(sig.odds || 1.0);
        const status = (sig.status || 'pending').toLowerCase();
        let profit = 0;

        if (status === 'won' || status === 'win') {
          profit = odds - 1.0;
          stats.wins++;
        } else if (status === 'half_win') {
          profit = 0.5 * (odds - 1.0);
          stats.wins++;
        } else if (status === 'push' || status === 'void') {
          profit = 0.0;
        } else if (status === 'half_loss') {
          profit = -0.5;
        } else {
          profit = -1.0;
        }

        stats.profitUnits += profit;

        const clvPct = sig.clv_percentage !== null && sig.clv_percentage !== undefined ? Number(sig.clv_percentage) : null;
        if (clvPct !== null) {
          stats.clvSum += clvPct;
          stats.clvCount++;
        }

        const modelProb = sig.probability !== null && sig.probability !== undefined ? Number(sig.probability) : null;
        const closingOdds = sig.closing_odds !== null && sig.closing_odds !== undefined ? Number(sig.closing_odds) : null;
        if (modelProb !== null && closingOdds && closingOdds > 1.0) {
          stats.modelProbSum += modelProb;
          stats.closingProbSum += 1.0 / closingOdds;
          stats.probCount++;
        }
      });

      const breakdown = Object.values(marketStats).map((s) => {
        const roi = s.bets > 0 ? (s.profitUnits / s.bets) * 100 : 0.0;
        const clv = s.clvCount > 0 ? s.clvSum / s.clvCount : 0.0;
        const accuracy = s.bets > 0 ? (s.wins / s.bets) * 100 : 0.0;
        const avgModelProb = s.probCount > 0 ? (s.modelProbSum / s.probCount) * 100 : 0.0;
        const avgClosingProb = s.probCount > 0 ? (s.closingProbSum / s.probCount) * 100 : 0.0;

        return {
          market: s.market,
          bets: s.bets,
          roi: Number(roi.toFixed(2)),
          clv: Number(clv.toFixed(2)),
          accuracy: Number(accuracy.toFixed(2)),
          avgModelProb: Number(avgModelProb.toFixed(2)),
          avgClosingProb: Number(avgClosingProb.toFixed(2)),
          trueEdge: Number((avgModelProb - avgClosingProb).toFixed(2)),
        };
      });

      return NextResponse.json({
        success: true,
        markets: breakdown,
      });
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message || 'Failed to fetch markets performance' }, { status: 500 });
    }
  }

  // 6. CLV Breakdown (rewritten from /api/performance/clv)
  if (view === 'clv') {
    try {
      if (source === 'canonical') {
        const report = CanonicalPerformanceEngine.generateReport();
        return NextResponse.json({
          success: true,
          source: 'canonical',
          averageClvPct: report.averageClvPct,
          positiveClvRatePct: report.positiveClvRatePct,
          totalClvAvailable: report.totalClvAvailable,
          clvProfitMatrix: report.clvProfitMatrix,
        });
      }

      const { data: signals, error } = await supabase
        .from('signals')
        .select('*')
        .not('settled_at', 'is', null);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const priorityALeagues = new Set(
        LEAGUE_REGISTRY.filter((l) => l.validation_priority === 'A').map((l) => l.name)
      );
      const filteredSignals = (signals || []).filter((sig) => sig.league && priorityALeagues.has(sig.league));

      let eliteCount = 0;
      let positiveCount = 0;
      let neutralCount = 0;
      let negativeCount = 0;
      let clvSum = 0;
      let clvCount = 0;
      const recentMovements: any[] = [];

      filteredSignals.forEach((sig) => {
        const clvPct = sig.clv_percentage !== null && sig.clv_percentage !== undefined ? Number(sig.clv_percentage) : null;
        if (clvPct !== null) {
          clvSum += clvPct;
          clvCount++;

          const category = sig.clv_category || (clvPct >= 5.0 ? 'Elite' : clvPct >= 0.5 ? 'Positive' : clvPct <= -0.5 ? 'Negative' : 'Neutral');

          if (category === 'Elite') eliteCount++;
          else if (category === 'Positive') positiveCount++;
          else if (category === 'Negative') negativeCount++;
          else neutralCount++;

          if (recentMovements.length < 20) {
            recentMovements.push({
              id: sig.id,
              match: `${sig.home_team} vs ${sig.away_team}`,
              market: sig.market,
              selection: sig.selection,
              openingOdds: sig.odds,
              closingOdds: sig.closing_odds,
              clvPercentage: clvPct,
              category,
            });
          }
        }
      });

      return NextResponse.json({
        success: true,
        averageClv: clvCount > 0 ? Number((clvSum / clvCount).toFixed(2)) : 0.0,
        distribution: {
          elite: eliteCount,
          positive: positiveCount,
          neutral: neutralCount,
          negative: negativeCount,
        },
        recentMovements,
      });
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message || 'Failed to fetch CLV data' }, { status: 500 });
    }
  }

  // 7. Leagues Breakdown (rewritten from /api/performance/leagues)
  if (view === 'leagues') {
    try {
      if (source === 'canonical') {
        const report = CanonicalPerformanceEngine.generateReport();
        return NextResponse.json({
          success: true,
          source: 'canonical',
          byLeague: report.byLeague,
        });
      }

      const { data: signals, error } = await supabase
        .from('signals')
        .select('*')
        .not('settled_at', 'is', null);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const priorityALeagues = new Set(
        LEAGUE_REGISTRY.filter((l) => l.validation_priority === 'A').map((l) => l.name)
      );
      const filteredSignals = (signals || []).filter((sig) => sig.league && priorityALeagues.has(sig.league));

      const leagueStats: Record<string, {
        league: string;
        bets: number;
        wins: number;
        profitUnits: number;
        clvSum: number;
        clvCount: number;
      }> = {};

      filteredSignals.forEach((sig) => {
        const lg = sig.league || 'Other';
        if (!leagueStats[lg]) {
          leagueStats[lg] = {
            league: lg,
            bets: 0,
            wins: 0,
            profitUnits: 0,
            clvSum: 0,
            clvCount: 0,
          };
        }

        const stats = leagueStats[lg];
        stats.bets++;

        const odds = Number(sig.odds || 1.0);
        const status = (sig.status || 'pending').toLowerCase();
        let profit = 0;

        if (status === 'won' || status === 'win') {
          profit = odds - 1.0;
          stats.wins++;
        } else if (status === 'half_win') {
          profit = 0.5 * (odds - 1.0);
          stats.wins++;
        } else if (status === 'push' || status === 'void') {
          profit = 0.0;
        } else if (status === 'half_loss') {
          profit = -0.5;
        } else {
          profit = -1.0;
        }

        stats.profitUnits += profit;

        const clvPct = sig.clv_percentage !== null && sig.clv_percentage !== undefined ? Number(sig.clv_percentage) : null;
        if (clvPct !== null) {
          stats.clvSum += clvPct;
          stats.clvCount++;
        }
      });

      const breakdown = Object.values(leagueStats).map((s) => {
        const roi = s.bets > 0 ? (s.profitUnits / s.bets) * 100 : 0.0;
        const clv = s.clvCount > 0 ? s.clvSum / s.clvCount : 0.0;
        const accuracy = s.bets > 0 ? (s.wins / s.bets) * 100 : 0.0;

        return {
          league: s.league,
          bets: s.bets,
          roi: Number(roi.toFixed(2)),
          clv: Number(clv.toFixed(2)),
          accuracy: Number(accuracy.toFixed(2)),
        };
      });

      return NextResponse.json({
        success: true,
        leagues: breakdown,
      });
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message || 'Failed to fetch leagues performance' }, { status: 500 });
    }
  }

  // 8. Canonical Full Performance Report (source=canonical or view=canonical)
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

  // 9. Paper-trading aggregation
  if (source === 'paper-trading') {
    try {
      const stats = await PerformanceAggregator.aggregate();
      return NextResponse.json(stats);
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
  }

  // 10. Daily Performance slice (view=daily)
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

  // 11. Default overall performance report across all horizons
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