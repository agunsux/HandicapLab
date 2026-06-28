import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { StrategyDecayMonitor } from '@/lib/intelligence/decay';
import { PerformanceAttribution } from '@/lib/intelligence/attribution';

export async function GET(request: Request) {
  try {
    // Fetch settled signals
    const { data: signals, error } = await supabase
      .from('signals')
      .select('*, signal_metrics(*)')
      .in('status', ['won', 'lost', 'void']);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!signals || signals.length === 0) {
      return NextResponse.json({
        success: true,
        overall: { roi: 0, clv: 0, win_rate: 0, calibration_error: 0, total_signals: 0 },
        by_competition: [],
        by_market: [],
        by_confidence: [],
        health: { status: 'healthy', rolling30: { roi: 0, clv: 0, winRate: 0, sampleSize: 0 }, rolling100: { roi: 0, clv: 0, winRate: 0, sampleSize: 0 } }
      });
    }

    // 1. Overall stats
    let totalSignals = 0;
    let wins = 0;
    let losses = 0;
    let totalRoi = 0;
    let totalClv = 0;
    let totalCalibErr = 0;
    let calibCount = 0;

    // Grouping accumulators
    const compGroups: Record<string, { total: number; wins: number; roi: number; clv: number }> = {};
    const marketGroups: Record<string, { total: number; wins: number; roi: number; clv: number }> = {};
    const confGroups: Record<string, { total: number; wins: number; roi: number; clv: number }> = {};

    for (const sig of signals) {
      const status = sig.status;
      if (status === 'void') continue;

      totalSignals++;
      const isWin = status === 'won';
      const isLoss = status === 'lost';
      const odds = Number(sig.odds || 1.95);
      const clv = Number(sig.clv_percentage !== null ? sig.clv_percentage : (sig.clv !== null ? sig.clv * 100 : 0));
      const edge = Number(sig.edge_pct || 0.0);

      let roi = 0;
      if (isWin) {
        wins++;
        roi = (odds - 1.0) * 100;
      } else if (isLoss) {
        losses++;
        roi = -100.0;
      }

      totalRoi += roi;
      totalClv += clv;

      if (sig.calibration_error !== undefined && sig.calibration_error !== null) {
        totalCalibErr += Number(sig.calibration_error);
        calibCount++;
      } else {
        // Compute dynamically if not saved
        const actualProb = isWin ? 1.0 : (isLoss ? 0.0 : 0.5);
        const pred = Number(sig.calibrated_probability !== null && sig.calibrated_probability !== undefined ? sig.calibrated_probability : (sig.probability || 0.5));
        totalCalibErr += Math.abs(pred - actualProb);
        calibCount++;
      }

      // Group by competition
      const comp = sig.league || 'Unknown';
      if (!compGroups[comp]) compGroups[comp] = { total: 0, wins: 0, roi: 0, clv: 0 };
      compGroups[comp].total++;
      if (isWin) compGroups[comp].wins++;
      compGroups[comp].roi += roi;
      compGroups[comp].clv += clv;

      // Group by market
      const mkt = sig.market_category || sig.market || 'moneyline';
      if (!marketGroups[mkt]) marketGroups[mkt] = { total: 0, wins: 0, roi: 0, clv: 0 };
      marketGroups[mkt].total++;
      if (isWin) marketGroups[mkt].wins++;
      marketGroups[mkt].roi += roi;
      marketGroups[mkt].clv += clv;

      // Group by confidence bucket
      const bucket = PerformanceAttribution.getConfidenceBucket(sig.confidence || 0.70);
      if (!confGroups[bucket]) confGroups[bucket] = { total: 0, wins: 0, roi: 0, clv: 0 };
      confGroups[bucket].total++;
      if (isWin) confGroups[bucket].wins++;
      confGroups[bucket].roi += roi;
      confGroups[bucket].clv += clv;
    }

    const overallRoi = totalSignals > 0 ? totalRoi / totalSignals : 0;
    const overallClv = totalSignals > 0 ? totalClv / totalSignals : 0;
    const overallWinRate = totalSignals > 0 ? (wins / totalSignals) * 100 : 0;
    const avgCalibErr = calibCount > 0 ? totalCalibErr / calibCount : 0;

    // Format grouping outputs
    const by_competition = Object.entries(compGroups).map(([competition, data]) => ({
      competition,
      total_signals: data.total,
      win_rate: Number(((data.wins / data.total) * 100).toFixed(2)),
      roi: Number((data.roi / data.total).toFixed(2)),
      clv: Number((data.clv / data.total).toFixed(2))
    }));

    const by_market = Object.entries(marketGroups).map(([market, data]) => ({
      market,
      total_signals: data.total,
      win_rate: Number(((data.wins / data.total) * 100).toFixed(2)),
      roi: Number((data.roi / data.total).toFixed(2)),
      clv: Number((data.clv / data.total).toFixed(2))
    }));

    const by_confidence = Object.entries(confGroups).map(([confidence_bucket, data]) => ({
      confidence_bucket,
      total_signals: data.total,
      win_rate: Number(((data.wins / data.total) * 100).toFixed(2)),
      roi: Number((data.roi / data.total).toFixed(2)),
      clv: Number((data.clv / data.total).toFixed(2))
    }));

    // Strategy Health monitors
    const health = StrategyDecayMonitor.evaluateHealth(signals);

    return NextResponse.json({
      success: true,
      overall: {
        roi: Number(overallRoi.toFixed(2)),
        clv: Number(overallClv.toFixed(2)),
        win_rate: Number(overallWinRate.toFixed(2)),
        calibration_error: Number(avgCalibErr.toFixed(4)),
        total_signals: totalSignals
      },
      by_competition,
      by_market,
      by_confidence,
      health
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
